import { Router } from "express";
import type { ProcessManager } from "../core/process-manager.js";

export function processesRouter(pm: ProcessManager): Router {
  const router = Router();

  // GET /count — get count (must be defined before /:id to avoid shadowing)
  router.get("/count", (_req, res) => {
    res.json({ count: pm.count() });
  });

  // GET / — list running processes
  router.get("/", (_req, res) => {
    res.json(pm.getRunning());
  });

  // POST /:id/kill — kill a process (404 if not found)
  router.post("/:id/kill", (req, res) => {
    const killed = pm.kill(req.params.id);
    if (!killed) {
      res.status(404).json({ error: "Process not found" });
      return;
    }
    res.json({ killed: true });
  });

  return router;
}
