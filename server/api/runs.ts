import { Router } from "express";
import type { Database } from "../core/db.js";
import type { WorkflowRunner } from "../core/workflow-runner.js";

export function runsRouter(db: Database, runner: WorkflowRunner): Router {
  const router = Router();

  // POST / — trigger a run (body: {workflow_id, params?}).
  // Creates the run record synchronously (sqlite is sync), returns run_id immediately,
  // then executes steps asynchronously.
  router.post("/", (req, res) => {
    const { workflow_id, params } = req.body as {
      workflow_id?: unknown;
      params?: unknown;
    };

    if (!workflow_id || typeof workflow_id !== "string") {
      res
        .status(400)
        .json({ error: "workflow_id is required and must be a string" });
      return;
    }

    const workflow = db.getWorkflow(workflow_id);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const resolvedParams =
      params && typeof params === "object" && !Array.isArray(params)
        ? (params as Record<string, string>)
        : {};

    // Create the run record synchronously so we can return run_id immediately.
    // db.createRun is synchronous (better-sqlite3).
    const runId = db.createRun(workflow_id, workflow.name, resolvedParams);

    // Fire and forget — runner picks up the pre-created run and executes steps
    runner
      .runFromExistingRun(runId, workflow_id, resolvedParams)
      .catch(() => {
        // Errors tracked inside the runner
      });

    res.status(201).json({ run_id: runId, workflow_id, status: "accepted" });
  });

  // GET / — list runs (optional ?workflow_id= filter)
  router.get("/", (req, res) => {
    const workflowId =
      typeof req.query.workflow_id === "string"
        ? req.query.workflow_id
        : undefined;
    const runs = db.listRuns(workflowId);
    res.json(runs);
  });

  // GET /:id — get single run with steps
  router.get("/:id", (req, res) => {
    const run = db.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    const steps = db.getRunSteps(req.params.id);
    res.json({ ...run, steps });
  });

  // GET /:runId/steps/:stepId/logs — get logs for a step
  router.get("/:runId/steps/:stepId/logs", (req, res) => {
    const run = db.getRun(req.params.runId);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    // Verify the step belongs to this run
    const steps = db.getRunSteps(req.params.runId);
    const step = steps.find((s) => s.id === req.params.stepId);
    if (!step) {
      res.status(404).json({ error: "Step not found" });
      return;
    }
    const logs = db.getRunLogs(req.params.stepId);
    res.json(logs);
  });

  // POST /:id/cancel — cancel a run
  router.post("/:id/cancel", (req, res) => {
    const run = db.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    if (run.status !== "running") {
      res
        .status(400)
        .json({ error: `Run is already in terminal state: ${run.status}` });
      return;
    }
    runner.cancelRun(req.params.id);
    res.json({ cancelled: true });
  });

  return router;
}
