import { randomUUID } from "crypto";
import type { Database } from "./db.js";
import type { ProcessManager } from "./process-manager.js";
import type { RunStatus, StepStatus } from "./types.js";
import { interpolate, expandHome } from "./variable-interpolator.js";

export class WorkflowRunner {
  activeRuns: Set<string> = new Set();
  cancelledRuns: Set<string> = new Set();
  maxConcurrent: number = 5;

  onStepStatus?: (data: {
    run_id: string;
    step_index: number;
    status: StepStatus;
    exit_code?: number;
  }) => void;

  onRunStatus?: (data: { run_id: string; status: RunStatus }) => void;

  onLog?: (data: {
    run_id: string;
    step_index: number;
    stream: "stdout" | "stderr";
    content: string;
  }) => void;

  constructor(private db: Database, private pm: ProcessManager) {}

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = n;
  }

  getActiveRunCount(): number {
    return this.activeRuns.size;
  }

  cancelRun(runId: string): void {
    this.cancelledRuns.add(runId);
  }

  async run(workflowId: string, params: Record<string, string> = {}): Promise<string> {
    // 1. Check concurrent limit
    if (this.activeRuns.size >= this.maxConcurrent) {
      throw new Error(
        `Concurrent run limit reached (max: ${this.maxConcurrent})`
      );
    }

    // 2. Get workflow from DB
    const workflow = this.db.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // 3. Create run record in DB
    const runId = this.db.createRun(workflowId, workflow.name, params);

    // Track the run
    this.activeRuns.add(runId);

    try {
      // 4. Create all step records upfront (with raw commands, before interpolation)
      const stepIds: string[] = [];
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepId = this.db.createRunStep(
          runId,
          i,
          step.name,
          step.command,
          step.type
        );
        stepIds.push(stepId);
      }

      // 5. Execute steps sequentially
      let runFailed = false;
      // capturedOutputs: key = output var name, value = last non-empty stdout line
      const capturedOutputs: Record<string, string> = {};

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepId = stepIds[i];

        // Check for cancellation before each step
        if (this.cancelledRuns.has(runId)) {
          // Mark this and remaining steps as cancelled
          for (let j = i; j < workflow.steps.length; j++) {
            this.db.updateRunStepStatus(stepIds[j], "cancelled");
            this.onStepStatus?.({
              run_id: runId,
              step_index: j,
              status: "cancelled",
            });
          }
          this.db.updateRunStatus(runId, "cancelled");
          this.onRunStatus?.({ run_id: runId, status: "cancelled" });
          this.activeRuns.delete(runId);
          this.cancelledRuns.delete(runId);
          return runId;
        }

        // If a previous step failed with on_failure: "stop", skip remaining
        if (runFailed) {
          this.db.updateRunStepStatus(stepId, "skipped");
          this.onStepStatus?.({
            run_id: runId,
            step_index: i,
            status: "skipped",
          });
          continue;
        }

        // Build interpolation context: workflow env + params + captured outputs
        const context: Record<string, string> = {
          ...(workflow.env ?? {}),
          ...params,
          ...capturedOutputs,
        };

        // Interpolate command
        const interpolatedCommand = interpolate(step.command, context);

        // Merge env for the process
        const processEnv: Record<string, string> = {
          ...(workflow.env ?? {}),
          ...(step.env ?? {}),
          ...params,
        };

        // Mark step as running
        this.db.updateRunStepStatus(stepId, "running");
        this.onStepStatus?.({
          run_id: runId,
          step_index: i,
          status: "running",
        });

        // Collect stdout lines for output capture
        let stdoutBuffer = "";

        // Spawn via ProcessManager
        const result = await this.pm.spawn({
          command: interpolatedCommand,
          type: step.type,
          workdir: expandHome(step.workdir),
          env: Object.keys(processEnv).length > 0 ? processEnv : undefined,
          timeout: step.timeout,
          onStdout: (data) => {
            stdoutBuffer += data;
            this.db.appendLog(stepId, "stdout", data);
            this.onLog?.({
              run_id: runId,
              step_index: i,
              stream: "stdout",
              content: data,
            });
          },
          onStderr: (data) => {
            this.db.appendLog(stepId, "stderr", data);
            this.onLog?.({
              run_id: runId,
              step_index: i,
              stream: "stderr",
              content: data,
            });
          },
        });

        // Determine step status
        let stepStatus: StepStatus;
        if (result.timedOut) {
          stepStatus = "timed_out";
        } else if (result.exitCode === 0 || result.exitCode === null) {
          stepStatus = result.timedOut ? "timed_out" : "completed";
          if (result.exitCode !== 0 && result.exitCode !== null) {
            stepStatus = "failed";
          }
        } else {
          stepStatus = "failed";
        }

        // On completion: update step status
        this.db.updateRunStepStatus(stepId, stepStatus, result.exitCode ?? undefined);
        this.onStepStatus?.({
          run_id: runId,
          step_index: i,
          status: stepStatus,
          exit_code: result.exitCode ?? undefined,
        });

        // Handle on_failure
        const stepFailed = stepStatus === "failed" || stepStatus === "timed_out";
        if (stepFailed) {
          const onFailure = step.on_failure ?? "stop";
          if (onFailure === "stop") {
            runFailed = true;
            // remaining steps will be marked skipped in the next iterations
          } else if (onFailure === "continue") {
            // continue to next step, but track that at least one step failed
            runFailed = false; // don't stop — but we still need to mark run as failed at the end
            // We'll use a separate flag for "at least one step failed"
          }
          // For "retry:N" — mark the run failed for simplicity (retry not yet implemented)
          if (typeof onFailure === "string" && onFailure.startsWith("retry:")) {
            runFailed = true;
          }
        }

        // Capture outputs: if step has outputs, capture last non-empty line of stdout
        if (step.outputs && !stepFailed) {
          const lines = stdoutBuffer
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          const lastLine = lines[lines.length - 1] ?? "";
          for (const outputKey of Object.keys(step.outputs)) {
            capturedOutputs[outputKey] = lastLine;
          }
        }
      }

      // Check if any step actually failed (for "continue" case)
      const steps = this.db.getRunSteps(runId);
      const anyFailed = steps.some(
        (s) => s.status === "failed" || s.status === "timed_out"
      );

      // 6. After all steps: update run status
      const finalStatus: RunStatus =
        anyFailed || runFailed ? "failed" : "completed";
      this.db.updateRunStatus(runId, finalStatus);
      this.onRunStatus?.({ run_id: runId, status: finalStatus });
    } finally {
      // 7. Remove from activeRuns
      this.activeRuns.delete(runId);
    }

    return runId;
  }
}
