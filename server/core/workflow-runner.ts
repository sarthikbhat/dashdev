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

  /**
   * Execute a run with a pre-created run record (used when the API creates
   * the run_id synchronously before handing off to async execution).
   */
  async runFromExistingRun(
    runId: string,
    workflowId: string,
    params: Record<string, string> = {}
  ): Promise<string> {
    if (this.activeRuns.size >= this.maxConcurrent) {
      this.db.updateRunStatus(runId, "failed");
      this.onRunStatus?.({ run_id: runId, status: "failed" });
      throw new Error(
        `Concurrent run limit reached (max: ${this.maxConcurrent})`
      );
    }

    const workflow = this.db.getWorkflow(workflowId);
    if (!workflow) {
      this.db.updateRunStatus(runId, "failed");
      this.onRunStatus?.({ run_id: runId, status: "failed" });
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    this.activeRuns.add(runId);
    return this._executeRun(runId, workflowId, workflow, params);
  }

  async run(workflowId: string, params: Record<string, string> = {}): Promise<string> {
    if (this.activeRuns.size >= this.maxConcurrent) {
      throw new Error(
        `Concurrent run limit reached (max: ${this.maxConcurrent})`
      );
    }

    const workflow = this.db.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const runId = this.db.createRun(workflowId, workflow.name, params);
    this.activeRuns.add(runId);
    return this._executeRun(runId, workflowId, workflow, params);
  }

  /** Shared execution logic for both run() and runFromExistingRun() */
  private async _executeRun(
    runId: string,
    workflowId: string,
    workflow: ReturnType<Database["getWorkflow"]> & {},
    params: Record<string, string>
  ): Promise<string> {
    try {
      // Create all step records upfront (with raw commands, before interpolation)
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

      // Execute steps sequentially
      let runFailed = false;
      const capturedOutputs: Record<string, string> = {};

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepId = stepIds[i];

        if (this.cancelledRuns.has(runId)) {
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

        if (runFailed) {
          this.db.updateRunStepStatus(stepId, "skipped");
          this.onStepStatus?.({
            run_id: runId,
            step_index: i,
            status: "skipped",
          });
          continue;
        }

        const context: Record<string, string> = {
          ...(workflow.env ?? {}),
          ...params,
          ...capturedOutputs,
        };

        const interpolatedCommand = interpolate(step.command, context);

        const processEnv: Record<string, string> = {
          ...(workflow.env ?? {}),
          ...(step.env ?? {}),
          ...params,
        };

        this.db.updateRunStepStatus(stepId, "running");
        this.onStepStatus?.({
          run_id: runId,
          step_index: i,
          status: "running",
        });

        let stdoutBuffer = "";

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

        this.db.updateRunStepStatus(stepId, stepStatus, result.exitCode ?? undefined);
        this.onStepStatus?.({
          run_id: runId,
          step_index: i,
          status: stepStatus,
          exit_code: result.exitCode ?? undefined,
        });

        const stepFailed = stepStatus === "failed" || stepStatus === "timed_out";
        if (stepFailed) {
          const onFailure = step.on_failure ?? "stop";
          if (onFailure === "stop") {
            runFailed = true;
          } else if (onFailure === "continue") {
            runFailed = false;
          }
          if (typeof onFailure === "string" && onFailure.startsWith("retry:")) {
            runFailed = true;
          }
        }

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

      const steps = this.db.getRunSteps(runId);
      const anyFailed = steps.some(
        (s) => s.status === "failed" || s.status === "timed_out"
      );

      const finalStatus: RunStatus =
        anyFailed || runFailed ? "failed" : "completed";
      this.db.updateRunStatus(runId, finalStatus);
      this.onRunStatus?.({ run_id: runId, status: finalStatus });
    } finally {
      this.activeRuns.delete(runId);
    }

    return runId;
  }
}
