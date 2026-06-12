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

      // Group steps into execution units (sequential or parallel branch groups)
      const executionPlan = this.buildExecutionPlan(workflow.steps);

      let runFailed = false;
      const capturedOutputs: Record<string, string> = {};

      for (const unit of executionPlan) {
        if (this.cancelledRuns.has(runId)) {
          for (const idx of unit.flatMap((u) => u.indices)) {
            this.db.updateRunStepStatus(stepIds[idx], "cancelled");
            this.onStepStatus?.({ run_id: runId, step_index: idx, status: "cancelled" });
          }
          continue;
        }

        if (runFailed) {
          for (const idx of unit.flatMap((u) => u.indices)) {
            this.db.updateRunStepStatus(stepIds[idx], "skipped");
            this.onStepStatus?.({ run_id: runId, step_index: idx, status: "skipped" });
          }
          continue;
        }

        if (unit.length === 1 && !unit[0].condition) {
          // Sequential step — run normally
          const branch = unit[0];
          for (const i of branch.indices) {
            if (this.cancelledRuns.has(runId)) break;
            if (runFailed) {
              this.db.updateRunStepStatus(stepIds[i], "skipped");
              this.onStepStatus?.({ run_id: runId, step_index: i, status: "skipped" });
              continue;
            }
            const result = await this.executeStep(runId, i, workflow.steps[i], stepIds[i], workflow, params, capturedOutputs);
            if (result.failed) runFailed = true;
          }
        } else {
          // Parallel branch group — evaluate conditions and run matching branches concurrently
          const context: Record<string, string> = {
            ...(workflow.env ?? {}),
            ...params,
            ...capturedOutputs,
          };

          // Separate branches with conditions from those without (default/else branches)
          const conditionalBranches = unit.filter((b) => b.condition);
          const defaultBranches = unit.filter((b) => !b.condition);

          let matchingBranches: typeof unit;
          if (conditionalBranches.length > 0) {
            // Evaluate conditions — only run branches whose condition is true
            const matched = conditionalBranches.filter((branch) =>
              this.evaluateCondition(branch.condition!, context)
            );
            // If no condition matched, fall back to default (else) branches
            matchingBranches = matched.length > 0 ? matched : defaultBranches;
          } else {
            // No conditions at all — run all branches in parallel
            matchingBranches = unit;
          }

          if (matchingBranches.length === 0) {
            for (const idx of unit.flatMap((u) => u.indices)) {
              this.db.updateRunStepStatus(stepIds[idx], "skipped");
              this.onStepStatus?.({ run_id: runId, step_index: idx, status: "skipped" });
            }
          } else {
            // Skip non-matching branches
            const matchingIndices = new Set(matchingBranches.flatMap((b) => b.indices));
            for (const idx of unit.flatMap((u) => u.indices)) {
              if (!matchingIndices.has(idx)) {
                this.db.updateRunStepStatus(stepIds[idx], "skipped");
                this.onStepStatus?.({ run_id: runId, step_index: idx, status: "skipped" });
              }
            }

            // Run matching branches in parallel
            const branchResults = await Promise.all(
              matchingBranches.map(async (branch) => {
                let branchFailed = false;
                for (const i of branch.indices) {
                  if (this.cancelledRuns.has(runId)) break;
                  if (branchFailed) {
                    this.db.updateRunStepStatus(stepIds[i], "skipped");
                    this.onStepStatus?.({ run_id: runId, step_index: i, status: "skipped" });
                    continue;
                  }
                  const result = await this.executeStep(runId, i, workflow.steps[i], stepIds[i], workflow, params, capturedOutputs);
                  if (result.failed) branchFailed = true;
                }
                return branchFailed;
              })
            );
            if (branchResults.some((f) => f)) runFailed = true;
          }
        }
      }

      if (this.cancelledRuns.has(runId)) {
        this.db.updateRunStatus(runId, "cancelled");
        this.onRunStatus?.({ run_id: runId, status: "cancelled" });
        this.cancelledRuns.delete(runId);
      } else {
        const steps = this.db.getRunSteps(runId);
        const anyFailed = steps.some(
          (s) => s.status === "failed" || s.status === "timed_out"
        );
        const finalStatus: RunStatus = anyFailed || runFailed ? "failed" : "completed";
        this.db.updateRunStatus(runId, finalStatus);
        this.onRunStatus?.({ run_id: runId, status: finalStatus });
      }
    } finally {
      this.activeRuns.delete(runId);
    }

    return runId;
  }

  private async executeStep(
    runId: string,
    stepIndex: number,
    step: ReturnType<Database["getWorkflow"]> & {} extends { steps: (infer S)[] } ? S : never,
    stepId: string,
    workflow: ReturnType<Database["getWorkflow"]> & {},
    params: Record<string, string>,
    capturedOutputs: Record<string, string>
  ): Promise<{ failed: boolean }> {
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
    this.onStepStatus?.({ run_id: runId, step_index: stepIndex, status: "running" });

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
        this.onLog?.({ run_id: runId, step_index: stepIndex, stream: "stdout", content: data });
      },
      onStderr: (data) => {
        this.db.appendLog(stepId, "stderr", data);
        this.onLog?.({ run_id: runId, step_index: stepIndex, stream: "stderr", content: data });
      },
    });

    let stepStatus: StepStatus;
    if (result.timedOut) {
      stepStatus = "timed_out";
    } else if (result.exitCode === 0 || result.exitCode === null) {
      stepStatus = "completed";
    } else {
      stepStatus = "failed";
    }

    this.db.updateRunStepStatus(stepId, stepStatus, result.exitCode ?? undefined);
    this.onStepStatus?.({
      run_id: runId,
      step_index: stepIndex,
      status: stepStatus,
      exit_code: result.exitCode ?? undefined,
    });

    const stepFailed = stepStatus === "failed" || stepStatus === "timed_out";
    if (stepFailed) {
      const onFailure = step.on_failure ?? "stop";
      if (onFailure === "continue") return { failed: false };
    }

    if (step.outputs && !stepFailed) {
      const lines = stdoutBuffer.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      const lastLine = lines[lines.length - 1] ?? "";
      for (const outputKey of Object.keys(step.outputs)) {
        capturedOutputs[outputKey] = lastLine;
      }
    }

    return { failed: stepFailed };
  }

  private buildExecutionPlan(
    steps: { branch_group?: string; branch_id?: string; branch_condition?: string }[]
  ): { indices: number[]; condition?: string }[][] {
    const plan: { indices: number[]; condition?: string }[][] = [];
    let i = 0;

    while (i < steps.length) {
      const step = steps[i];
      if (step.branch_group) {
        const groupId = step.branch_group;
        const branches = new Map<string, { indices: number[]; condition?: string }>();

        while (i < steps.length && steps[i].branch_group === groupId) {
          const branchId = steps[i].branch_id ?? "default";
          if (!branches.has(branchId)) {
            branches.set(branchId, { indices: [], condition: steps[i].branch_condition });
          }
          branches.get(branchId)!.indices.push(i);
          i++;
        }
        plan.push(Array.from(branches.values()));
      } else {
        plan.push([{ indices: [i] }]);
        i++;
      }
    }
    return plan;
  }

  private evaluateCondition(
    condition: string,
    context: Record<string, string>
  ): boolean {
    const interpolated = interpolate(condition, context);
    // Resolve bare variable names: if left side of comparison is a context key, use its value
    const resolve = (s: string): string => {
      const t = s.trim();
      return t in context ? context[t] : t;
    };
    const neqMatch = interpolated.match(/^(.+?)\s*!=\s*(.+)$/);
    if (neqMatch) return resolve(neqMatch[1]) !== resolve(neqMatch[2]);
    const eqMatch = interpolated.match(/^(.+?)\s*={1,2}\s*(.+)$/);
    if (eqMatch) return resolve(eqMatch[1]) === resolve(eqMatch[2]);
    // Truthy: non-empty, not "false", not "0"
    const val = resolve(interpolated);
    return val !== "" && val !== "false" && val !== "0";
  }
}
