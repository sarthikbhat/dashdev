import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { unlinkSync, existsSync } from "fs";
import { Database } from "../core/db.js";

const TEST_DB = "/tmp/devdash-test.db";

let db: Database;

beforeEach(() => {
  db = new Database(TEST_DB);
});

afterEach(() => {
  db.close();
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB);
  }
});

// ─── Workflows ────────────────────────────────────────────────────────────────

describe("Workflows", () => {
  const workflowInput = {
    id: "wf-1",
    name: "Test Workflow",
    description: "A test workflow",
    icon: "rocket",
    tags: ["ci", "test"],
    source: "yaml" as const,
    file_path: "/workflows/test.yaml",
    steps: [
      {
        name: "Build",
        command: "npm run build",
        type: "run-and-done" as const,
      },
    ],
  };

  it("upsertWorkflow inserts a new workflow", () => {
    db.upsertWorkflow(workflowInput);
    const wf = db.getWorkflow("wf-1");
    expect(wf).not.toBeNull();
    expect(wf!.id).toBe("wf-1");
    expect(wf!.name).toBe("Test Workflow");
    expect(wf!.description).toBe("A test workflow");
    expect(wf!.icon).toBe("rocket");
    expect(wf!.tags).toEqual(["ci", "test"]);
    expect(wf!.source).toBe("yaml");
    expect(wf!.file_path).toBe("/workflows/test.yaml");
    expect(wf!.steps).toHaveLength(1);
    expect(wf!.steps[0].name).toBe("Build");
  });

  it("upsertWorkflow updates an existing workflow", async () => {
    db.upsertWorkflow(workflowInput);
    const first = db.getWorkflow("wf-1")!;

    // Wait so updated_at is strictly later than created_at
    await new Promise((r) => setTimeout(r, 5));
    db.upsertWorkflow({ ...workflowInput, name: "Updated Workflow", description: "Updated desc" });
    const updated = db.getWorkflow("wf-1")!;

    expect(updated.name).toBe("Updated Workflow");
    expect(updated.description).toBe("Updated desc");
    expect(updated.created_at).toBe(first.created_at);
    expect(updated.updated_at).not.toBe(first.updated_at);
  });

  it("getWorkflow returns null for unknown id", () => {
    expect(db.getWorkflow("nope")).toBeNull();
  });

  it("listWorkflows returns all workflows", () => {
    db.upsertWorkflow(workflowInput);
    db.upsertWorkflow({ ...workflowInput, id: "wf-2", name: "Second Workflow" });
    const list = db.listWorkflows();
    expect(list).toHaveLength(2);
  });

  it("deleteWorkflow removes the workflow", () => {
    db.upsertWorkflow(workflowInput);
    db.deleteWorkflow("wf-1");
    expect(db.getWorkflow("wf-1")).toBeNull();
    expect(db.listWorkflows()).toHaveLength(0);
  });
});

// ─── Runs ─────────────────────────────────────────────────────────────────────

describe("Runs", () => {
  beforeEach(() => {
    db.upsertWorkflow({
      id: "wf-1",
      name: "Test Workflow",
      source: "yaml" as const,
      steps: [],
    });
  });

  it("createRun returns a run id and the run has running status", () => {
    const runId = db.createRun("wf-1", "Test Workflow", { env: "staging" });
    expect(typeof runId).toBe("string");
    expect(runId.length).toBeGreaterThan(0);

    const run = db.getRun(runId)!;
    expect(run.workflow_id).toBe("wf-1");
    expect(run.workflow_name).toBe("Test Workflow");
    expect(run.status).toBe("running");
    expect(run.params_used).toEqual({ env: "staging" });
    expect(run.started_at).toBeTruthy();
    expect(run.finished_at).toBeUndefined();
    expect(run.duration_ms).toBeUndefined();
  });

  it("getRun returns null for unknown id", () => {
    expect(db.getRun("nope")).toBeNull();
  });

  it("updateRunStatus sets terminal status with finished_at and duration_ms", async () => {
    const runId = db.createRun("wf-1", "Test Workflow", {});
    // Small pause so duration_ms > 0 is plausible
    await new Promise((r) => setTimeout(r, 5));
    db.updateRunStatus(runId, "completed");
    const run = db.getRun(runId)!;
    expect(run.status).toBe("completed");
    expect(run.finished_at).toBeTruthy();
    expect(typeof run.duration_ms).toBe("number");
    expect(run.duration_ms!).toBeGreaterThanOrEqual(0);
  });

  it("listRuns returns all runs when no filter", () => {
    db.upsertWorkflow({ id: "wf-2", name: "Second", source: "yaml" as const, steps: [] });
    db.createRun("wf-1", "Test Workflow", {});
    db.createRun("wf-2", "Second", {});
    expect(db.listRuns()).toHaveLength(2);
  });

  it("listRuns filters by workflowId", () => {
    db.upsertWorkflow({ id: "wf-2", name: "Second", source: "yaml" as const, steps: [] });
    db.createRun("wf-1", "Test Workflow", {});
    db.createRun("wf-2", "Second", {});
    const filtered = db.listRuns("wf-1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].workflow_id).toBe("wf-1");
  });
});

// ─── Run Steps ────────────────────────────────────────────────────────────────

describe("Run Steps", () => {
  let runId: string;

  beforeEach(() => {
    db.upsertWorkflow({ id: "wf-1", name: "Test Workflow", source: "yaml" as const, steps: [] });
    runId = db.createRun("wf-1", "Test Workflow", {});
  });

  it("createRunStep returns a step id with pending status", () => {
    const stepId = db.createRunStep(runId, 0, "Build", "npm run build", "run-and-done");
    expect(typeof stepId).toBe("string");

    const steps = db.getRunSteps(runId);
    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe(stepId);
    expect(steps[0].run_id).toBe(runId);
    expect(steps[0].step_index).toBe(0);
    expect(steps[0].name).toBe("Build");
    expect(steps[0].command).toBe("npm run build");
    expect(steps[0].type).toBe("run-and-done");
    expect(steps[0].status).toBe("pending");
    expect(steps[0].started_at).toBeUndefined();
    expect(steps[0].finished_at).toBeUndefined();
  });

  it("updateRunStepStatus to running sets started_at", () => {
    const stepId = db.createRunStep(runId, 0, "Build", "npm run build", "run-and-done");
    db.updateRunStepStatus(stepId, "running");
    const steps = db.getRunSteps(runId);
    expect(steps[0].status).toBe("running");
    expect(steps[0].started_at).toBeTruthy();
    expect(steps[0].finished_at).toBeUndefined();
  });

  it("updateRunStepStatus to completed sets finished_at, duration_ms, and optional exit_code", async () => {
    const stepId = db.createRunStep(runId, 0, "Build", "npm run build", "run-and-done");
    db.updateRunStepStatus(stepId, "running");
    await new Promise((r) => setTimeout(r, 5));
    db.updateRunStepStatus(stepId, "completed", 0);
    const steps = db.getRunSteps(runId);
    expect(steps[0].status).toBe("completed");
    expect(steps[0].finished_at).toBeTruthy();
    expect(typeof steps[0].duration_ms).toBe("number");
    expect(steps[0].duration_ms!).toBeGreaterThanOrEqual(0);
    expect(steps[0].exit_code).toBe(0);
  });

  it("updateRunStepStatus to failed sets finished_at and exit_code", async () => {
    const stepId = db.createRunStep(runId, 0, "Build", "npm run build", "run-and-done");
    db.updateRunStepStatus(stepId, "running");
    await new Promise((r) => setTimeout(r, 2));
    db.updateRunStepStatus(stepId, "failed", 1);
    const steps = db.getRunSteps(runId);
    expect(steps[0].status).toBe("failed");
    expect(steps[0].exit_code).toBe(1);
    expect(steps[0].finished_at).toBeTruthy();
  });

  it("getRunSteps returns steps in step_index order", () => {
    db.createRunStep(runId, 2, "Deploy", "npm run deploy", "run-and-done");
    db.createRunStep(runId, 0, "Build", "npm run build", "run-and-done");
    db.createRunStep(runId, 1, "Test", "npm test", "run-and-done");
    const steps = db.getRunSteps(runId);
    expect(steps.map((s) => s.step_index)).toEqual([0, 1, 2]);
  });
});

// ─── Run Logs ─────────────────────────────────────────────────────────────────

describe("Run Logs", () => {
  let stepId: string;

  beforeEach(() => {
    db.upsertWorkflow({ id: "wf-1", name: "Test Workflow", source: "yaml" as const, steps: [] });
    const runId = db.createRun("wf-1", "Test Workflow", {});
    stepId = db.createRunStep(runId, 0, "Build", "npm run build", "run-and-done");
  });

  it("appendLog stores a log entry and getRunLogs retrieves it", () => {
    db.appendLog(stepId, "stdout", "Hello world\n");
    const logs = db.getRunLogs(stepId);
    expect(logs).toHaveLength(1);
    expect(logs[0].run_step_id).toBe(stepId);
    expect(logs[0].stream).toBe("stdout");
    expect(logs[0].content).toBe("Hello world\n");
    expect(logs[0].timestamp).toBeTruthy();
  });

  it("getRunLogs returns logs ordered by timestamp", async () => {
    db.appendLog(stepId, "stdout", "line 1\n");
    await new Promise((r) => setTimeout(r, 2));
    db.appendLog(stepId, "stderr", "error line\n");
    await new Promise((r) => setTimeout(r, 2));
    db.appendLog(stepId, "stdout", "line 3\n");

    const logs = db.getRunLogs(stepId);
    expect(logs).toHaveLength(3);
    expect(logs[0].content).toBe("line 1\n");
    expect(logs[1].stream).toBe("stderr");
    expect(logs[2].content).toBe("line 3\n");

    // Verify ascending timestamp order
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i].timestamp >= logs[i - 1].timestamp).toBe(true);
    }
  });

  it("getRunLogs returns empty array for unknown stepId", () => {
    expect(db.getRunLogs("nope")).toEqual([]);
  });
});

// ─── Processes ────────────────────────────────────────────────────────────────

describe("Processes", () => {
  let stepId: string;

  beforeEach(() => {
    db.upsertWorkflow({ id: "wf-1", name: "Test Workflow", source: "yaml" as const, steps: [] });
    const runId = db.createRun("wf-1", "Test Workflow", {});
    stepId = db.createRunStep(runId, 0, "Serve", "npm start", "long-running");
  });

  it("trackProcess stores a process and getRunningProcesses returns it", () => {
    db.trackProcess(stepId, 1234, 1234, "long-running", "npm start");
    const procs = db.getRunningProcesses();
    expect(procs).toHaveLength(1);
    expect(procs[0].run_step_id).toBe(stepId);
    expect(procs[0].pid).toBe(1234);
    expect(procs[0].pgid).toBe(1234);
    expect(procs[0].type).toBe("long-running");
    expect(procs[0].command).toBe("npm start");
    expect(procs[0].status).toBe("running");
  });

  it("updateProcessStatus changes status to stopped", () => {
    db.trackProcess(stepId, 5678, 5678, "daemon", "my-daemon");
    const procs = db.getRunningProcesses();
    const procId = procs[0].id;
    db.updateProcessStatus(procId, "stopped");
    expect(db.getRunningProcesses()).toHaveLength(0);
  });

  it("getRunningProcesses does not return non-running processes", () => {
    db.trackProcess(stepId, 111, 111, "long-running", "cmd1");
    const [proc] = db.getRunningProcesses();
    db.updateProcessStatus(proc.id, "killed");
    expect(db.getRunningProcesses()).toHaveLength(0);
  });
});
