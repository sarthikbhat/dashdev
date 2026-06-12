import { Router } from "express";
import { exec, spawn as nodeSpawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "../core/db.js";
import type { ServiceMonitor } from "../core/service-monitor.js";
import type { ProcessManager } from "../core/process-manager.js";
import type { Service } from "../core/types.js";
import { parseBackendctl } from "../core/backendctl-parser.js";

const execAsync = promisify(exec);

function extractWorkdir(startCommand: string): string | undefined {
  const cdMatch = startCommand.match(/cd\s+["']?([^"'&;]+)["']?/);
  if (cdMatch) {
    return cdMatch[1].trim().replace(/\$HOME/g, process.env.HOME ?? "~");
  }
  return undefined;
}

function detectSetupCommand(workdir: string): string | undefined {
  try {
    const files = fs.readdirSync(workdir);
    if (files.includes("Gemfile")) return "bundle install";
    if (files.includes("pnpm-lock.yaml")) return "pnpm install";
    if (files.includes("yarn.lock")) return "yarn install";
    if (files.includes("package-lock.json")) return "npm install";
    if (files.includes("package.json")) return "npm install";
    if (files.includes("requirements.txt")) return "pip install -r requirements.txt";
    if (files.includes("go.mod")) return "go mod download";
  } catch {
    // workdir doesn't exist or isn't readable
  }
  return undefined;
}

function startServiceProcess(
  service: Service,
  db: Database,
): { logFile: string } {
  const logDir = "/tmp/devdash-logs";
  const logFile = `${logDir}/${service.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.log`;
  const escaped = service.start_command!.replace(/'/g, "'\\''");

  const workdir = service.workdir ?? extractWorkdir(service.start_command!);
  const setupCmd = service.setup_command ?? (workdir ? detectSetupCommand(workdir) : undefined);

  let fullCmd = `mkdir -p ${logDir} && : > '${logFile}'`;
  if (setupCmd && workdir) {
    const escapedSetup = setupCmd.replace(/'/g, "'\\''");
    fullCmd += ` && cd '${workdir}' && ${escapedSetup} >> '${logFile}' 2>&1`;
  }
  fullCmd += ` && nohup zsh -c '${escaped}' >> '${logFile}' 2>&1 &`;

  const child = nodeSpawn("zsh", ["-l", "-c", fullCmd], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  if (!service.log_file) {
    db.updateService(service.id, { log_file: logFile });
  }

  return { logFile };
}

export function servicesRouter(
  db: Database,
  monitor: ServiceMonitor,
  pm: ProcessManager
): Router {
  const router = Router();

  // ─── GET /status — must come before /:id ─────────────────────────────────────
  router.get("/status", (_req, res) => {
    res.json(monitor.getStatus());
  });

  // ─── GET /groups — must come before /:id ─────────────────────────────────────
  router.get("/groups", (_req, res) => {
    res.json(db.listServiceGroups());
  });

  // ─── POST /groups ─────────────────────────────────────────────────────────────
  router.post("/groups", (req, res) => {
    const { name, service_ids } = req.body as {
      name?: unknown;
      service_ids?: unknown;
    };

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required and must be a string" });
      return;
    }
    if (!Array.isArray(service_ids)) {
      res.status(400).json({ error: "service_ids is required and must be an array" });
      return;
    }

    const id = db.createServiceGroup(name, service_ids as string[]);
    const group = db.getServiceGroup(id);
    res.status(201).json(group);
  });

  // ─── PUT /groups/:id ──────────────────────────────────────────────────────────
  router.put("/groups/:id", (req, res) => {
    const group = db.getServiceGroup(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Service group not found" });
      return;
    }

    const { name, service_ids } = req.body as {
      name?: unknown;
      service_ids?: unknown;
    };

    db.updateServiceGroup(
      req.params.id,
      typeof name === "string" ? name : undefined,
      Array.isArray(service_ids) ? (service_ids as string[]) : undefined
    );

    res.json(db.getServiceGroup(req.params.id));
  });

  // ─── DELETE /groups/:id ───────────────────────────────────────────────────────
  router.delete("/groups/:id", (req, res) => {
    const group = db.getServiceGroup(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Service group not found" });
      return;
    }
    db.deleteServiceGroup(req.params.id);
    res.json({ deleted: true });
  });

  // ─── POST /groups/:id/start ───────────────────────────────────────────────────
  router.post("/groups/:id/start", async (req, res) => {
    const group = db.getServiceGroup(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Service group not found" });
      return;
    }

    res.status(202).json({ started: true, group_id: group.id });

    for (const serviceId of group.service_ids) {
      const service = db.getService(serviceId);
      if (!service?.start_command) continue;
      startServiceProcess(service, db);
    }
  });

  // ─── POST /groups/:id/stop ────────────────────────────────────────────────────
  router.post("/groups/:id/stop", async (req, res) => {
    const group = db.getServiceGroup(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Service group not found" });
      return;
    }

    res.status(202).json({ stopped: true, group_id: group.id });

    // Stop services in background
    (async () => {
      for (const serviceId of group.service_ids) {
        const service = db.getService(serviceId);
        if (!service) continue;
        try {
          const stopCmd = service.stop_command
            ? service.stop_command
            : `lsof -ti :${service.port} | xargs kill`;
          await pm.spawn({ command: stopCmd, type: "shell" });
        } catch {
          // Continue on error
        }
      }
    })().catch(() => undefined);
  });

  // ─── POST /import-backendctl ──────────────────────────────────────────────────
  router.post("/import-backendctl", (req, res) => {
    const { file_path } = req.body as { file_path?: unknown };
    if (!file_path || typeof file_path !== "string") {
      res.status(400).json({ error: "file_path is required and must be a string" });
      return;
    }

    try {
      const result = parseBackendctl(file_path);

      // Insert parsed services into DB
      for (const svc of result.services) {
        db.createService({
          name: svc.name,
          port: svc.port,
          health_check_type: svc.health_check_type,
          health_check_value: svc.health_check_value,
          start_command: svc.start_command,
          stop_command: svc.stop_command,
          setup_command: svc.setup_command,
          workdir: svc.workdir,
          category: svc.category,
        });
      }

      // Insert parsed groups into DB
      const allServices = db.listServices();
      for (const group of result.groups) {
        const serviceIds = group.service_names
          .map((name: string) => allServices.find((s) => s.name === name)?.id)
          .filter((id): id is string => !!id);
        if (serviceIds.length > 0) {
          db.createServiceGroup(group.name, serviceIds);
        }
      }

      res.json({ imported: result.services.length, groups: result.groups });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: `Failed to parse backendctl file: ${message}` });
    }
  });

  // ─── GET / — list all services with health status ────────────────────────────
  router.get("/", (_req, res) => {
    const services = db.listServices();
    const statuses = monitor.getStatus();
    const statusMap = new Map(statuses.map((s) => [s.service_id, s]));

    const result = services.map((svc) => ({
      ...svc,
      health: statusMap.get(svc.id) ?? null,
    }));

    res.json(result);
  });

  // ─── POST / — create a service ────────────────────────────────────────────────
  router.post("/", (req, res) => {
    const {
      name,
      port,
      health_check_type,
      health_check_value,
      start_command,
      stop_command,
      setup_command,
      workdir,
      category,
      log_file,
    } = req.body as {
      name?: unknown;
      port?: unknown;
      health_check_type?: unknown;
      health_check_value?: unknown;
      start_command?: unknown;
      stop_command?: unknown;
      setup_command?: unknown;
      workdir?: unknown;
      category?: unknown;
      log_file?: unknown;
    };

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required and must be a string" });
      return;
    }
    if (port === undefined || port === null || typeof port !== "number") {
      res.status(400).json({ error: "port is required and must be a number" });
      return;
    }

    const id = db.createService({
      name,
      port,
      health_check_type: typeof health_check_type === "string" ? health_check_type : undefined,
      health_check_value: typeof health_check_value === "string" ? health_check_value : undefined,
      start_command: typeof start_command === "string" ? start_command : undefined,
      stop_command: typeof stop_command === "string" ? stop_command : undefined,
      setup_command: typeof setup_command === "string" ? setup_command : undefined,
      workdir: typeof workdir === "string" ? workdir : undefined,
      category: typeof category === "string" ? category : undefined,
      log_file: typeof log_file === "string" ? log_file : undefined,
    });

    res.status(201).json(db.getService(id));
  });

  // ─── PUT /:id — update a service ─────────────────────────────────────────────
  router.put("/:id", (req, res) => {
    const service = db.getService(req.params.id);
    if (!service) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    const {
      name,
      port,
      health_check_type,
      health_check_value,
      start_command,
      stop_command,
      setup_command,
      workdir,
      category,
      log_file,
    } = req.body as {
      name?: unknown;
      port?: unknown;
      health_check_type?: unknown;
      health_check_value?: unknown;
      start_command?: unknown;
      stop_command?: unknown;
      setup_command?: unknown;
      workdir?: unknown;
      category?: unknown;
      log_file?: unknown;
    };

    db.updateService(req.params.id, {
      name: typeof name === "string" ? name : undefined,
      port: typeof port === "number" ? port : undefined,
      health_check_type: typeof health_check_type === "string" ? health_check_type : undefined,
      health_check_value: typeof health_check_value === "string" ? health_check_value : undefined,
      start_command: typeof start_command === "string" ? start_command : undefined,
      stop_command: typeof stop_command === "string" ? stop_command : undefined,
      setup_command: typeof setup_command === "string" ? setup_command : undefined,
      workdir: typeof workdir === "string" ? workdir : undefined,
      category: typeof category === "string" ? category : undefined,
      log_file: typeof log_file === "string" ? log_file : undefined,
    });

    res.json(db.getService(req.params.id));
  });

  // ─── DELETE /:id — delete a service ──────────────────────────────────────────
  router.delete("/:id", (req, res) => {
    const service = db.getService(req.params.id);
    if (!service) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    db.deleteService(req.params.id);
    res.json({ deleted: true });
  });

  // ─── POST /:id/start ──────────────────────────────────────────────────────────
  router.post("/:id/start", (req, res) => {
    const service = db.getService(req.params.id);
    if (!service) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    if (!service.start_command) {
      res.status(400).json({ error: "Service has no start_command configured" });
      return;
    }

    const { logFile } = startServiceProcess(service, db);
    res.status(202).json({ started: true, log_file: logFile });
  });

  // ─── POST /:id/stop ───────────────────────────────────────────────────────────
  router.post("/:id/stop", (req, res) => {
    const service = db.getService(req.params.id);
    if (!service) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    const stopCmd = service.stop_command
      ? service.stop_command
      : `lsof -ti :${service.port} | xargs kill`;

    pm.spawn({ command: stopCmd, type: "shell" }).catch(() => undefined);

    res.status(202).json({ stopped: true });
  });

  // ─── POST /:id/restart ────────────────────────────────────────────────────────
  router.post("/:id/restart", (req, res) => {
    const service = db.getService(req.params.id);
    if (!service) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    res.status(202).json({ restarting: true });

    (async () => {
      // Stop
      const stopCmd = service.stop_command
        ? service.stop_command
        : `lsof -ti :${service.port} | xargs kill`;
      try {
        await pm.spawn({ command: stopCmd, type: "shell" });
      } catch {
        // Ignore stop errors — service may already be down
      }

      // Wait 2 seconds
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));

      if (service.start_command) {
        startServiceProcess(service, db);
      }
    })().catch(() => undefined);
  });

  // ─── GET /:id/logs ────────────────────────────────────────────────────────────
  router.get("/:id/logs", async (req, res) => {
    const service = db.getService(req.params.id);
    if (!service) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    if (!service.log_file) {
      res.status(400).json({ error: "Service has no log_file configured" });
      return;
    }

    try {
      const { stdout } = await execAsync(`tail -200 ${JSON.stringify(service.log_file)}`);
      const lines = stdout.split("\n");
      // Remove trailing empty line from tail output
      if (lines[lines.length - 1] === "") lines.pop();
      res.json({ lines });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Failed to read log file: ${message}` });
    }
  });

  return router;
}
