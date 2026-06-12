import BetterSqlite3 from "better-sqlite3";
import { randomUUID, createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import type {
  Workflow,
  WorkflowSource,
  WorkflowStep,
  WorkflowParam,
  FlowNode,
  Run,
  RunStatus,
  RunStep,
  StepStatus,
  StepType,
  RunLog,
  TrackedProcess,
  ProcessStatus,
  Service,
  HealthCheckType,
  ServiceCategory,
  ServiceGroup,
} from "./types.js";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface UpsertWorkflowInput {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tags?: string[];
  env?: Record<string, string>;
  params?: WorkflowParam[];
  steps: WorkflowStep[];
  nodes?: FlowNode[];
  source: WorkflowSource;
  file_path?: string;
}

// ─── Row types (raw SQLite rows) ──────────────────────────────────────────────

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  tags: string;
  env: string;
  params: string;
  definition: string;
  source: string;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

interface RunRow {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: string;
  params_used: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

interface RunStepRow {
  id: string;
  run_id: string;
  step_index: number;
  name: string;
  command: string;
  type: string;
  status: string;
  exit_code: number | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
}

interface RunLogRow {
  id: string;
  run_step_id: string;
  stream: string;
  content: string;
  timestamp: string;
}

interface ProcessRow {
  id: string;
  run_step_id: string;
  pid: number;
  pgid: number;
  type: string;
  status: string;
  command: string;
  started_at: string;
  stopped_at: string | null;
}

interface ServiceRow {
  id: string;
  name: string;
  port: number;
  health_check_type: string;
  health_check_value: string | null;
  start_command: string | null;
  stop_command: string | null;
  setup_command: string | null;
  workdir: string | null;
  category: string;
  log_file: string | null;
  created_at: string;
  updated_at: string;
}

interface ServiceGroupRow {
  id: string;
  name: string;
  service_ids: string;
  created_at: string;
}

// ─── Database class ───────────────────────────────────────────────────────────

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  // ─── Migrations ─────────────────────────────────────────────────────────────

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        icon        TEXT,
        tags        TEXT NOT NULL DEFAULT '[]',
        env         TEXT NOT NULL DEFAULT '{}',
        params      TEXT NOT NULL DEFAULT '[]',
        definition  TEXT NOT NULL DEFAULT '{}',
        source      TEXT NOT NULL DEFAULT 'yaml',
        file_path   TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runs (
        id            TEXT PRIMARY KEY,
        workflow_id   TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        workflow_name TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'running',
        params_used   TEXT NOT NULL DEFAULT '{}',
        started_at    TEXT NOT NULL,
        finished_at   TEXT,
        duration_ms   INTEGER
      );

      CREATE TABLE IF NOT EXISTS run_steps (
        id          TEXT PRIMARY KEY,
        run_id      TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        step_index  INTEGER NOT NULL,
        name        TEXT NOT NULL,
        command     TEXT NOT NULL,
        type        TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending',
        exit_code   INTEGER,
        started_at  TEXT,
        finished_at TEXT,
        duration_ms INTEGER
      );

      CREATE TABLE IF NOT EXISTS run_logs (
        id          TEXT PRIMARY KEY,
        run_step_id TEXT NOT NULL REFERENCES run_steps(id) ON DELETE CASCADE,
        stream      TEXT NOT NULL,
        content     TEXT NOT NULL,
        timestamp   TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS processes (
        id          TEXT PRIMARY KEY,
        run_step_id TEXT NOT NULL REFERENCES run_steps(id) ON DELETE CASCADE,
        pid         INTEGER NOT NULL,
        pgid        INTEGER NOT NULL,
        type        TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'running',
        command     TEXT NOT NULL,
        started_at  TEXT NOT NULL,
        stopped_at  TEXT
      );

      CREATE TABLE IF NOT EXISTS services (
        id                 TEXT PRIMARY KEY,
        name               TEXT NOT NULL,
        port               INTEGER NOT NULL,
        health_check_type  TEXT NOT NULL DEFAULT 'port',
        health_check_value TEXT,
        start_command      TEXT,
        stop_command       TEXT,
        category           TEXT NOT NULL DEFAULT 'app',
        log_file           TEXT,
        created_at         TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS service_groups (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        service_ids TEXT NOT NULL DEFAULT '[]',
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Add setup_command and workdir columns if missing
    const cols = this.db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has("setup_command")) {
      this.db.exec("ALTER TABLE services ADD COLUMN setup_command TEXT");
    }
    if (!colNames.has("workdir")) {
      this.db.exec("ALTER TABLE services ADD COLUMN workdir TEXT");
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private now(): string {
    return new Date().toISOString();
  }

  private rowToWorkflow(row: WorkflowRow): Workflow {
    const definition = JSON.parse(row.definition) as {
      steps?: WorkflowStep[];
      env?: Record<string, string>;
      nodes?: FlowNode[];
    };
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      icon: row.icon ?? undefined,
      tags: JSON.parse(row.tags) as string[],
      env: definition.env ?? (JSON.parse(row.env) as Record<string, string>),
      params: JSON.parse(row.params) as WorkflowParam[],
      steps: (definition.steps ?? []) as WorkflowStep[],
      nodes: definition.nodes,
      source: row.source as WorkflowSource,
      file_path: row.file_path ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private rowToRun(row: RunRow): Run {
    return {
      id: row.id,
      workflow_id: row.workflow_id,
      workflow_name: row.workflow_name,
      status: row.status as RunStatus,
      params_used: JSON.parse(row.params_used) as Record<string, string>,
      started_at: row.started_at,
      finished_at: row.finished_at ?? undefined,
      duration_ms: row.duration_ms ?? undefined,
    };
  }

  private rowToRunStep(row: RunStepRow): RunStep {
    return {
      id: row.id,
      run_id: row.run_id,
      step_index: row.step_index,
      name: row.name,
      command: row.command,
      type: row.type as StepType,
      status: row.status as StepStatus,
      exit_code: row.exit_code ?? undefined,
      started_at: row.started_at ?? undefined,
      finished_at: row.finished_at ?? undefined,
      duration_ms: row.duration_ms ?? undefined,
    };
  }

  private rowToRunLog(row: RunLogRow): RunLog {
    return {
      id: row.id,
      run_step_id: row.run_step_id,
      stream: row.stream as "stdout" | "stderr",
      content: row.content,
      timestamp: row.timestamp,
    };
  }

  private rowToProcess(row: ProcessRow): TrackedProcess {
    return {
      id: row.id,
      run_step_id: row.run_step_id,
      pid: row.pid,
      pgid: row.pgid,
      type: row.type as StepType,
      status: row.status as ProcessStatus,
      command: row.command,
      started_at: row.started_at,
      stopped_at: row.stopped_at ?? undefined,
    };
  }

  // ─── Workflow methods ─────────────────────────────────────────────────────────

  upsertWorkflow(input: UpsertWorkflowInput): void {
    const now = this.now();
    const definition = JSON.stringify({
      steps: input.steps,
      env: input.env ?? {},
      ...(input.nodes ? { nodes: input.nodes } : {}),
    });

    const existing = this.db
      .prepare("SELECT created_at FROM workflows WHERE id = ?")
      .get(input.id) as { created_at: string } | undefined;

    const created_at = existing?.created_at ?? now;

    this.db
      .prepare(
        `INSERT INTO workflows (id, name, description, icon, tags, env, params, definition, source, file_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name        = excluded.name,
           description = excluded.description,
           icon        = excluded.icon,
           tags        = excluded.tags,
           env         = excluded.env,
           params      = excluded.params,
           definition  = excluded.definition,
           source      = excluded.source,
           file_path   = excluded.file_path,
           updated_at  = excluded.updated_at`
      )
      .run(
        input.id,
        input.name,
        input.description ?? null,
        input.icon ?? null,
        JSON.stringify(input.tags ?? []),
        JSON.stringify(input.env ?? {}),
        JSON.stringify(input.params ?? []),
        definition,
        input.source,
        input.file_path ?? null,
        created_at,
        now
      );
  }

  getWorkflow(id: string): Workflow | null {
    const row = this.db
      .prepare("SELECT * FROM workflows WHERE id = ?")
      .get(id) as WorkflowRow | undefined;
    return row ? this.rowToWorkflow(row) : null;
  }

  listWorkflows(): Workflow[] {
    const rows = this.db
      .prepare("SELECT * FROM workflows ORDER BY name ASC")
      .all() as WorkflowRow[];
    return rows.map((r) => this.rowToWorkflow(r));
  }

  deleteWorkflow(id: string): void {
    this.db.prepare("DELETE FROM workflows WHERE id = ?").run(id);
  }

  // ─── Run methods ──────────────────────────────────────────────────────────────

  createRun(
    workflowId: string,
    workflowName: string,
    params: Record<string, string>
  ): string {
    const id = randomUUID();
    const now = this.now();
    this.db
      .prepare(
        `INSERT INTO runs (id, workflow_id, workflow_name, status, params_used, started_at)
         VALUES (?, ?, ?, 'running', ?, ?)`
      )
      .run(id, workflowId, workflowName, JSON.stringify(params), now);
    return id;
  }

  getRun(id: string): Run | null {
    const row = this.db
      .prepare("SELECT * FROM runs WHERE id = ?")
      .get(id) as RunRow | undefined;
    return row ? this.rowToRun(row) : null;
  }

  listRuns(workflowId?: string): Run[] {
    let rows: RunRow[];
    if (workflowId) {
      rows = this.db
        .prepare(
          "SELECT * FROM runs WHERE workflow_id = ? ORDER BY started_at DESC"
        )
        .all(workflowId) as RunRow[];
    } else {
      rows = this.db
        .prepare("SELECT * FROM runs ORDER BY started_at DESC")
        .all() as RunRow[];
    }
    return rows.map((r) => this.rowToRun(r));
  }

  updateRunStatus(id: string, status: RunStatus): void {
    const run = this.db
      .prepare("SELECT started_at FROM runs WHERE id = ?")
      .get(id) as { started_at: string } | undefined;

    const terminalStatuses: RunStatus[] = [
      "completed",
      "failed",
      "cancelled",
      "timed_out",
    ];

    if (run && terminalStatuses.includes(status)) {
      const now = this.now();
      const duration_ms =
        new Date(now).getTime() - new Date(run.started_at).getTime();
      this.db
        .prepare(
          "UPDATE runs SET status = ?, finished_at = ?, duration_ms = ? WHERE id = ?"
        )
        .run(status, now, duration_ms, id);
    } else {
      this.db.prepare("UPDATE runs SET status = ? WHERE id = ?").run(status, id);
    }
  }

  // ─── Run Step methods ─────────────────────────────────────────────────────────

  createRunStep(
    runId: string,
    stepIndex: number,
    name: string,
    command: string,
    type: StepType
  ): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO run_steps (id, run_id, step_index, name, command, type, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      )
      .run(id, runId, stepIndex, name, command, type);
    return id;
  }

  getRunSteps(runId: string): RunStep[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM run_steps WHERE run_id = ? ORDER BY step_index ASC"
      )
      .all(runId) as RunStepRow[];
    return rows.map((r) => this.rowToRunStep(r));
  }

  updateRunStepStatus(
    id: string,
    status: StepStatus,
    exitCode?: number
  ): void {
    const terminalStatuses: StepStatus[] = [
      "completed",
      "failed",
      "cancelled",
      "timed_out",
      "skipped",
    ];

    if (status === "running") {
      const now = this.now();
      this.db
        .prepare(
          "UPDATE run_steps SET status = ?, started_at = ? WHERE id = ?"
        )
        .run(status, now, id);
    } else if (terminalStatuses.includes(status)) {
      const step = this.db
        .prepare("SELECT started_at FROM run_steps WHERE id = ?")
        .get(id) as { started_at: string | null } | undefined;

      const now = this.now();
      let duration_ms: number | null = null;
      if (step?.started_at) {
        duration_ms =
          new Date(now).getTime() - new Date(step.started_at).getTime();
      }

      this.db
        .prepare(
          `UPDATE run_steps
           SET status = ?, finished_at = ?, duration_ms = ?, exit_code = ?
           WHERE id = ?`
        )
        .run(
          status,
          now,
          duration_ms,
          exitCode ?? null,
          id
        );
    } else {
      this.db
        .prepare("UPDATE run_steps SET status = ? WHERE id = ?")
        .run(status, id);
    }
  }

  // ─── Run Log methods ──────────────────────────────────────────────────────────

  appendLog(
    runStepId: string,
    stream: "stdout" | "stderr",
    content: string
  ): void {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO run_logs (id, run_step_id, stream, content, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, runStepId, stream, content, timestamp);
  }

  getRunLogs(runStepId: string): RunLog[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM run_logs WHERE run_step_id = ? ORDER BY timestamp ASC"
      )
      .all(runStepId) as RunLogRow[];
    return rows.map((r) => this.rowToRunLog(r));
  }

  // ─── Process methods ──────────────────────────────────────────────────────────

  trackProcess(
    runStepId: string,
    pid: number,
    pgid: number,
    type: StepType,
    command: string
  ): string {
    const id = randomUUID();
    const now = this.now();
    this.db
      .prepare(
        `INSERT INTO processes (id, run_step_id, pid, pgid, type, status, command, started_at)
         VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`
      )
      .run(id, runStepId, pid, pgid, type, command, now);
    return id;
  }

  updateProcessStatus(id: string, status: ProcessStatus): void {
    const terminalStatuses: ProcessStatus[] = ["stopped", "killed", "crashed"];
    if (terminalStatuses.includes(status)) {
      const now = this.now();
      this.db
        .prepare(
          "UPDATE processes SET status = ?, stopped_at = ? WHERE id = ?"
        )
        .run(status, now, id);
    } else {
      this.db
        .prepare("UPDATE processes SET status = ? WHERE id = ?")
        .run(status, id);
    }
  }

  getRunningProcesses(): TrackedProcess[] {
    const rows = this.db
      .prepare("SELECT * FROM processes WHERE status = 'running' ORDER BY started_at ASC")
      .all() as ProcessRow[];
    return rows.map((r) => this.rowToProcess(r));
  }

  // ─── Services ────────────────────────────────────────────────────────────────

  private rowToService(row: ServiceRow): Service {
    return {
      id: row.id,
      name: row.name,
      port: row.port,
      health_check_type: row.health_check_type as HealthCheckType,
      health_check_value: row.health_check_value ?? undefined,
      start_command: row.start_command ?? undefined,
      stop_command: row.stop_command ?? undefined,
      setup_command: row.setup_command ?? undefined,
      workdir: row.workdir ?? undefined,
      category: row.category as ServiceCategory,
      log_file: row.log_file ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  createService(input: {
    name: string;
    port: number;
    health_check_type?: string;
    health_check_value?: string;
    start_command?: string;
    stop_command?: string;
    setup_command?: string;
    workdir?: string;
    category?: string;
    log_file?: string;
  }): string {
    const id = randomUUID();
    const now = this.now();
    this.db
      .prepare(
        `INSERT INTO services (id, name, port, health_check_type, health_check_value, start_command, stop_command, setup_command, workdir, category, log_file, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.port,
        input.health_check_type ?? "port",
        input.health_check_value ?? null,
        input.start_command ?? null,
        input.stop_command ?? null,
        input.setup_command ?? null,
        input.workdir ?? null,
        input.category ?? "app",
        input.log_file ?? null,
        now,
        now
      );
    return id;
  }

  getService(id: string): Service | undefined {
    const row = this.db
      .prepare("SELECT * FROM services WHERE id = ?")
      .get(id) as ServiceRow | undefined;
    return row ? this.rowToService(row) : undefined;
  }

  listServices(): Service[] {
    const rows = this.db
      .prepare("SELECT * FROM services ORDER BY category ASC, name ASC")
      .all() as ServiceRow[];
    return rows.map((r) => this.rowToService(r));
  }

  updateService(
    id: string,
    input: Partial<{
      name: string;
      port: number;
      health_check_type: string;
      health_check_value: string;
      start_command: string;
      stop_command: string;
      setup_command: string;
      workdir: string;
      category: string;
      log_file: string;
    }>
  ): void {
    const now = this.now();
    const fields: string[] = ["updated_at = ?"];
    const values: unknown[] = [now];

    if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
    if (input.port !== undefined) { fields.push("port = ?"); values.push(input.port); }
    if (input.health_check_type !== undefined) { fields.push("health_check_type = ?"); values.push(input.health_check_type); }
    if (input.health_check_value !== undefined) { fields.push("health_check_value = ?"); values.push(input.health_check_value); }
    if (input.start_command !== undefined) { fields.push("start_command = ?"); values.push(input.start_command); }
    if (input.stop_command !== undefined) { fields.push("stop_command = ?"); values.push(input.stop_command); }
    if (input.setup_command !== undefined) { fields.push("setup_command = ?"); values.push(input.setup_command); }
    if (input.workdir !== undefined) { fields.push("workdir = ?"); values.push(input.workdir); }
    if (input.category !== undefined) { fields.push("category = ?"); values.push(input.category); }
    if (input.log_file !== undefined) { fields.push("log_file = ?"); values.push(input.log_file); }

    values.push(id);
    this.db
      .prepare(`UPDATE services SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  deleteService(id: string): void {
    this.db.prepare("DELETE FROM services WHERE id = ?").run(id);
  }

  // ─── Service Groups ───────────────────────────────────────────────────────────

  private rowToServiceGroup(row: ServiceGroupRow): ServiceGroup {
    return {
      id: row.id,
      name: row.name,
      service_ids: JSON.parse(row.service_ids) as string[],
      created_at: row.created_at,
    };
  }

  createServiceGroup(name: string, serviceIds: string[]): string {
    const id = randomUUID();
    const now = this.now();
    this.db
      .prepare(
        `INSERT INTO service_groups (id, name, service_ids, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(id, name, JSON.stringify(serviceIds), now);
    return id;
  }

  getServiceGroup(id: string): ServiceGroup | undefined {
    const row = this.db
      .prepare("SELECT * FROM service_groups WHERE id = ?")
      .get(id) as ServiceGroupRow | undefined;
    return row ? this.rowToServiceGroup(row) : undefined;
  }

  listServiceGroups(): ServiceGroup[] {
    const rows = this.db
      .prepare("SELECT * FROM service_groups ORDER BY name ASC")
      .all() as ServiceGroupRow[];
    return rows.map((r) => this.rowToServiceGroup(r));
  }

  updateServiceGroup(
    id: string,
    name?: string,
    serviceIds?: string[]
  ): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) { fields.push("name = ?"); values.push(name); }
    if (serviceIds !== undefined) { fields.push("service_ids = ?"); values.push(JSON.stringify(serviceIds)); }

    if (fields.length === 0) return;

    values.push(id);
    this.db
      .prepare(`UPDATE service_groups SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  deleteServiceGroup(id: string): void {
    this.db.prepare("DELETE FROM service_groups WHERE id = ?").run(id);
  }

  // ─── Settings (key-value) ─────────────────────────────────────────────────────

  private static ENCRYPTION_KEY = scryptSync("devdash-local-encryption", "devdash-salt", 32);

  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", Database.ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  }

  private decrypt(text: string): string {
    const [ivHex, encHex] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", Database.ENCRYPTION_KEY, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
  }

  deleteSetting(key: string): void {
    this.db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  }

  getEncryptedSetting(key: string): string | null {
    const raw = this.getSetting(key);
    if (!raw) return null;
    try {
      return this.decrypt(raw);
    } catch {
      return null;
    }
  }

  setEncryptedSetting(key: string, value: string): void {
    this.setSetting(key, this.encrypt(value));
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}
