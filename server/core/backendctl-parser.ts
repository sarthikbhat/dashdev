import fs from "node:fs";

export interface ParsedService {
  name: string;
  port: number;
  category: "infra" | "app";
  start_command?: string;
  stop_command?: string;
  setup_command?: string;
  workdir?: string;
  health_check_type: "port" | "http" | "command";
  health_check_value?: string;
}

export interface ParsedGroup {
  name: string;
  service_names: string[];
}

export interface BackendctlParseResult {
  services: ParsedService[];
  groups: ParsedGroup[];
}

export function parseBackendctl(filePath: string): BackendctlParseResult {
  const content = fs.readFileSync(filePath, "utf-8");

  const services: ParsedService[] = [];
  const groups: ParsedGroup[] = [];

  // ── 1. Parse SERVICES array ────────────────────────────────────────────────
  // Format:
  //   SERVICES=(
  //     "mysql          brew            3306   infra"
  //     ...
  //   )
  const servicesMatch = content.match(/SERVICES=\(\n([\s\S]*?)\n\)/);
  if (servicesMatch) {
    for (const line of servicesMatch[1].split("\n")) {
      const match = line.match(/"(\S+)\s+(\S+)\s+(\d+)\s+(\S+)"/);
      if (match) {
        const [, name, , portStr, category] = match;
        services.push({
          name,
          port: parseInt(portStr, 10),
          category: category === "infra" ? "infra" : "app",
          health_check_type: "port", // overridden below
        });
      }
    }
  }

  // ── 2. Parse service groups ────────────────────────────────────────────────
  // TM_SERVICES=(mysql redis clickhouse testhub teststack)
  // TRA_SERVICES=(postgresql zookeeper kafka ...)
  const groupRegex = /^(\w+_SERVICES)=\(([^)]+)\)/gm;
  let groupMatch: RegExpExecArray | null;
  while ((groupMatch = groupRegex.exec(content)) !== null) {
    const rawName = groupMatch[1].replace(/_SERVICES$/, "").replace(/_/g, " ");
    const serviceNames = groupMatch[2].trim().split(/\s+/);
    groups.push({ name: rawName, service_names: serviceNames });
  }

  // ── 3. Extract health check details from health_check() ───────────────────
  // Parses per-service case blocks to detect HTTP, command, or port checks.
  const healthSection = extractFunctionBody(content, "health_check");
  if (healthSection) {
    for (const svc of services) {
      const block = extractCaseBlock(healthSection, svc.name);
      if (!block) continue;

      // HTTP check via curl — find any http(s)://localhost:PORT/path in the block
      const curlHttpMatch = block.match(/(https?:\/\/localhost:\d+[^\s"')]*)/);
      if (curlHttpMatch) {
        svc.health_check_type = "http";
        svc.health_check_value = curlHttpMatch[1];
        continue;
      }

      // Bare curl with no scheme (e.g. curl -sf localhost:8123)
      const curlBareMatch = block.match(/curl\s+(?:-\S+\s+)*(?:--\S+\s+\S+\s+)*(localhost:\d+[^\s"')*]*)/);
      if (curlBareMatch && !curlBareMatch[1].startsWith("-")) {
        svc.health_check_type = "http";
        svc.health_check_value = `http://${curlBareMatch[1]}`;
        continue;
      }

      // Command-based checks
      if (block.includes("redis-cli")) {
        svc.health_check_type = "command";
        svc.health_check_value = "redis-cli ping";
        continue;
      }
      if (block.includes("mysql")) {
        svc.health_check_type = "command";
        svc.health_check_value = 'mysql -u root -h 127.0.0.1 -e "SELECT 1"';
        continue;
      }
      if (block.includes("psql") || block.includes("PGPASSWORD")) {
        svc.health_check_type = "command";
        svc.health_check_value = 'PGPASSWORD=Password123 psql -U browserstack obs -c "SELECT 1"';
        continue;
      }

      // Port-only check (port_open usage)
      if (block.includes("port_open")) {
        svc.health_check_type = "port";
        // value stays undefined — port is already stored on the service
      }
    }
  }

  // ── 4. Extract start commands ──────────────────────────────────────────────
  // For brew-managed infra services pull from start_service().
  // For app services pull the first meaningful line from app_cmd().
  const startSection = extractFunctionBody(content, "start_service");
  if (startSection) {
    for (const svc of services) {
      const block = extractCaseBlock(startSection, svc.name);
      if (!block) continue;

      const brewMatch = block.match(/brew services start (\S+)/);
      if (brewMatch) {
        svc.start_command = `brew services start ${brewMatch[1]}`;
        continue;
      }

      // Kafka/Zookeeper — script-based
      if (svc.name === "zookeeper") {
        svc.start_command = "$KAFKA_DIR/bin/zookeeper-server-start.sh -daemon $KAFKA_DIR/config/zookeeper.properties";
        continue;
      }
      if (svc.name === "kafka") {
        svc.start_command = "$KAFKA_DIR/bin/kafka-server-start.sh -daemon $KAFKA_DIR/config/server.properties";
        continue;
      }
      if (svc.name === "clickhouse") {
        svc.start_command = 'clickhouse server --config-file="$CH_CONFIG"';
        continue;
      }
      if (svc.name === "elasticsearch") {
        svc.start_command = 'ES_JAVA_HOME="$JAVA_HOME_17" "$ES_DIR/bin/elasticsearch" -d -p /tmp/elasticsearch.pid';
        continue;
      }
    }
  }

  // App service start commands from app_cmd()
  // The app_cmd() function uses heredocs — each case block contains the full
  // setup sequence (env init, cd, exec). We need the ENTIRE block as a single
  // command, joined with &&, because the exec depends on the setup lines.
  const appCmdSection = extractFunctionBody(content, "app_cmd");
  if (appCmdSection) {
    for (const svc of services) {
      if (svc.category !== "app") continue;

      // app_cmd uses heredocs: cat <<'ECMD' ... ECMD
      // Extract the heredoc body for this service's case block
      const heredocCmd = extractAppCmdHeredoc(content, svc.name);
      if (heredocCmd) {
        svc.start_command = heredocCmd;
        continue;
      }

      // Fallback: regular case block parsing
      const block = extractCaseBlock(appCmdSection, svc.name);
      if (!block) continue;
      const lines = block.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("ECMD"));
      if (lines.length > 0) {
        svc.start_command = lines.map((l) => l.replace(/^exec\s+/, "")).join(" && ");
      }
    }
  }

  // ── 5. Extract stop commands ───────────────────────────────────────────────
  const stopSection = extractFunctionBody(content, "stop_service");
  if (stopSection) {
    for (const svc of services) {
      const block = extractCaseBlock(stopSection, svc.name);
      if (!block) continue;

      const brewMatch = block.match(/brew services stop (\S+)/);
      if (brewMatch) {
        svc.stop_command = `brew services stop ${brewMatch[1]}`;
        continue;
      }

      if (svc.name === "zookeeper") {
        svc.stop_command = "$KAFKA_DIR/bin/zookeeper-server-stop.sh";
        continue;
      }
      if (svc.name === "kafka") {
        svc.stop_command = "$KAFKA_DIR/bin/kafka-server-stop.sh";
        continue;
      }
      if (svc.name === "clickhouse") {
        svc.stop_command = 'pkill -f "clickhouse server"';
        continue;
      }
      if (svc.name === "elasticsearch") {
        svc.stop_command = "kill $(cat /tmp/elasticsearch.pid) 2>/dev/null || pkill -f elasticsearch";
        continue;
      }

      // App services — port-based kill
      if (block.includes("pid_on_port") || block.includes("kill")) {
        svc.stop_command = `lsof -ti :${svc.port} | xargs kill`;
      }
    }
  }

  // ── 6. Extract workdir and auto-detect setup commands ───────────────────
  for (const svc of services) {
    if (!svc.start_command) continue;
    const cdMatch = svc.start_command.match(/cd\s+["']?([^"'&;]+)["']?/);
    if (cdMatch) {
      svc.workdir = cdMatch[1].trim();
      const resolved = svc.workdir
        .replace(/\$HOME/g, process.env.HOME ?? "~")
        .replace(/\$BASE_DIR/g, `${process.env.HOME}/Desktop/code/tm/backend`);
      try {
        const files = fs.readdirSync(resolved);
        if (files.includes("Gemfile")) svc.setup_command = "bundle install";
        else if (files.includes("pnpm-lock.yaml")) svc.setup_command = "pnpm install";
        else if (files.includes("yarn.lock")) svc.setup_command = "yarn install";
        else if (files.includes("package-lock.json")) svc.setup_command = "npm install";
        else if (files.includes("package.json")) svc.setup_command = "npm install";
      } catch {
        // workdir doesn't exist yet
      }
    }
  }

  return { services, groups };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts the body of a bash function (everything between the opening `{`
 * and the matching closing `}` at column 0).
 */
function extractFunctionBody(content: string, funcName: string): string | null {
  // Match: funcName() {\n ... \n}  where the closing brace is at start of line
  const pattern = new RegExp(`${funcName}\\s*\\(\\)[\\s\\S]*?^\\}`, "m");
  const match = content.match(pattern);
  return match ? match[0] : null;
}

/**
 * Extracts the content of a bash case block for a given service name.
 * Handles names with hyphens (e.g. obs-api).
 * Returns the text between `name)` and the next `;;` or `*)`.
 */
/**
 * Extracts the heredoc body from app_cmd() for a given service.
 * Looks for: serviceName) cat <<'ECMD'\n...\nECMD
 * Joins all meaningful lines with && and strips `exec` prefix.
 * Fixes known portability issues (e.g. $HOME/.rbenv/bin/rbenv → $(which rbenv)).
 */
function extractAppCmdHeredoc(content: string, serviceName: string): string | null {
  const escaped = serviceName.replace(/-/g, "\\-");
  const pattern = new RegExp(
    `${escaped}\\)\\s+cat\\s+<<['\"]?ECMD['\"]?\\n([\\s\\S]*?)\\nECMD`,
    "m"
  );
  const match = content.match(pattern);
  if (!match) return null;

  const lines = match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  // Strip `exec` prefix, collapse if/fi blocks into flat commands
  const processed: string[] = [];
  let inIf = false;
  for (const line of lines) {
    if (line.startsWith("if ") || line === "if") { inIf = true; continue; }
    if (line === "fi") { inIf = false; continue; }
    if (line === "elif" || line.startsWith("elif ")) continue;
    if (line === "else") continue;
    if (inIf) continue;

    let cmd = line.replace(/^exec\s+/, "");
    // Fix hardcoded rbenv path → use whatever is on PATH
    cmd = cmd.replace(/\$HOME\/\.rbenv\/bin\/rbenv/g, "rbenv");
    cmd = cmd.replace(/"\$HOME\/\.rbenv\/bin\/rbenv"/g, "rbenv");
    // Fix nvm source path → use brew nvm if available
    cmd = cmd.replace(/source ~\/\.nvm\/nvm\.sh/g, "source $(brew --prefix nvm)/nvm.sh 2>/dev/null || source ~/.nvm/nvm.sh");
    processed.push(cmd);
  }

  return processed.length > 0 ? processed.join(" && ") : null;
}

function extractCaseBlock(funcBody: string, serviceName: string): string | null {
  // Escape hyphens for regex
  const escaped = serviceName.replace(/-/g, "\\-");
  // A case arm can be bare (one service) or grouped (svc1|svc2|...)
  // We need to find either:  `  serviceName)` or `svc1|serviceName|svc2)`
  const pattern = new RegExp(
    `(?:^|\\|)\\s*${escaped}\\s*(?:\\||\\))([\\s\\S]*?)(?=;;|\\*\\)|[a-zA-Z][a-zA-Z0-9_-]*(?:\\|[a-zA-Z][a-zA-Z0-9_-]*)*\\))`,
    "m"
  );
  const match = funcBody.match(pattern);
  return match ? match[1] : null;
}
