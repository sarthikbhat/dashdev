import { Router } from "express";
import type { Database } from "../core/db.js";

export function workflowsRouter(db: Database): Router {
  const router = Router();

  // GET / — list all workflows
  router.get("/", (_req, res) => {
    const workflows = db.listWorkflows();
    res.json(workflows);
  });

  // GET /:id — get single workflow (404 if not found)
  router.get("/:id", (req, res) => {
    const workflow = db.getWorkflow(req.params.id);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json(workflow);
  });

  // PUT /:id — create/update UI-created workflow (requires name + steps in body)
  router.put("/:id", (req, res) => {
    const { name, steps, nodes, description, icon, tags, env, params } = req.body as {
      name?: unknown;
      steps?: unknown;
      nodes?: unknown;
      description?: string;
      icon?: string;
      tags?: string[];
      env?: Record<string, string>;
      params?: unknown[];
    };

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required and must be a string" });
      return;
    }
    if (!Array.isArray(steps)) {
      res.status(400).json({ error: "steps is required and must be an array" });
      return;
    }

    db.upsertWorkflow({
      id: req.params.id,
      name,
      steps: steps as import("../core/types.js").WorkflowStep[],
      nodes: Array.isArray(nodes) ? nodes as import("../core/types.js").FlowNode[] : undefined,
      description,
      icon,
      tags,
      env,
      params: params as import("../core/types.js").WorkflowParam[] | undefined,
      source: "ui",
    });

    const workflow = db.getWorkflow(req.params.id);
    res.json(workflow);
  });

  // DELETE /:id
  router.delete("/:id", (req, res) => {
    const workflow = db.getWorkflow(req.params.id);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    db.deleteWorkflow(req.params.id);
    res.json({ deleted: true });
  });

  return router;
}
