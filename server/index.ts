import express from "express";
import cors from "cors";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { Server as SocketIOServer } from "socket.io";

import { Database } from "./core/db.js";
import { ProcessManager } from "./core/process-manager.js";
import { WorkflowRunner } from "./core/workflow-runner.js";
import { loadAllYamlWorkflows } from "./core/yaml-loader.js";
import { loadAllJsWorkflows } from "./core/js-loader.js";
import { workflowsRouter } from "./api/workflows.js";
import { runsRouter } from "./api/runs.js";
import { processesRouter } from "./api/processes.js";
import type { ServerToClientEvents, ClientToServerEvents } from "./core/types.js";

// ── Config ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.DEVDASH_PORT ?? "3847", 10);
const HOME_DIR = path.join(os.homedir(), ".devdash");
const WORKFLOWS_DIR = path.join(HOME_DIR, "workflows");
const DB_PATH = path.join(HOME_DIR, "devdash.db");

// ── Ensure directories exist ──────────────────────────────────────────────────

fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });

// ── Initialize core ───────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
const pm = new ProcessManager();
const runner = new WorkflowRunner(db, pm);

// ── syncWorkflows ─────────────────────────────────────────────────────────────

async function syncWorkflows(): Promise<void> {
  const yamlWorkflows = loadAllYamlWorkflows(WORKFLOWS_DIR);
  const jsWorkflows = await loadAllJsWorkflows(WORKFLOWS_DIR);

  for (const wf of yamlWorkflows) {
    db.upsertWorkflow({
      id: wf.id,
      name: wf.name,
      description: wf.description,
      icon: wf.icon,
      tags: wf.tags,
      env: wf.env,
      params: wf.params,
      steps: wf.steps,
      source: wf.source,
      file_path: wf.file_path,
    });
  }

  for (const wf of jsWorkflows) {
    db.upsertWorkflow({
      id: wf.id,
      name: wf.name,
      description: wf.description,
      icon: wf.icon,
      tags: wf.tags,
      env: undefined,
      params: undefined,
      steps: [],
      source: wf.source,
      file_path: wf.file_path,
    });
  }

  const total = yamlWorkflows.length + jsWorkflows.length;
  if (total > 0) {
    console.log(`[devdash] Synced ${total} workflow(s) from ${WORKFLOWS_DIR}`);
  }
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/workflows", workflowsRouter(db));
app.use("/api/runs", runsRouter(db, runner));
app.use("/api/processes", processesRouter(pm));

// Health endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    processes: pm.count(),
    active_runs: runner.getActiveRunCount(),
    uptime: process.uptime(),
  });
});

// ── Serve built UI ────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiDistPath = path.resolve(__dirname, "../ui/dist");

if (fs.existsSync(uiDistPath)) {
  app.use(express.static(uiDistPath));
  // SPA fallback: serve index.html for all non-API routes
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(uiDistPath, "index.html"));
  });
}

// ── HTTP + Socket.IO ──────────────────────────────────────────────────────────

const server = http.createServer(app);

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: "*" },
});

// Wire runner callbacks → socket.io broadcast
runner.onRunStatus = (data) => {
  io.emit("run:status", data);
};

runner.onStepStatus = (data) => {
  io.emit("step:status", data);
};

runner.onLog = (data) => {
  io.emit("step:log", data);
};

// Socket client events
io.on("connection", (socket) => {
  socket.on("run:cancel", ({ run_id }) => {
    runner.cancelRun(run_id);
  });

  socket.on("process:kill", ({ id }) => {
    pm.kill(id);
  });
});

// ── Watch workflows dir ───────────────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

fs.watch(WORKFLOWS_DIR, () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log("[devdash] Workflows directory changed — re-syncing...");
    syncWorkflows().catch((err: unknown) => {
      console.error("[devdash] Error re-syncing workflows:", err);
    });
  }, 500);
});

// ── Cleanup on exit ───────────────────────────────────────────────────────────

function shutdown(): void {
  console.log("\n[devdash] Shutting down...");
  pm.killAll();
  db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("uncaughtException", (err) => {
  console.error("[devdash] Uncaught exception:", err);
  pm.killAll();
  db.close();
  process.exit(1);
});

// ── Start ─────────────────────────────────────────────────────────────────────

await syncWorkflows();

server.listen(PORT, () => {
  console.log(`DevDash running at http://localhost:${PORT}`);
});
