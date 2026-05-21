import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { WorkflowStep, WorkflowParam, WorkflowSource } from "./types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoadedWorkflow {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tags?: string[];
  env?: Record<string, string>;
  params?: WorkflowParam[];
  steps: WorkflowStep[];
  source: WorkflowSource;
  file_path: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function mapStep(raw: Record<string, unknown>): WorkflowStep {
  return {
    name: raw.name as string,
    command: raw.command as string,
    type: (raw.type as WorkflowStep["type"]) ?? "run-and-done",
    ...(raw.workdir !== undefined && { workdir: raw.workdir as string }),
    ...(raw.timeout !== undefined && { timeout: raw.timeout as number }),
    ...(raw.on_failure !== undefined && { on_failure: raw.on_failure as WorkflowStep["on_failure"] }),
    ...(raw.env !== undefined && { env: raw.env as Record<string, string> }),
    ...(raw.health_check !== undefined && { health_check: raw.health_check as WorkflowStep["health_check"] }),
    ...(raw.outputs !== undefined && { outputs: raw.outputs as Record<string, string> }),
  };
}

function mapParam(raw: Record<string, unknown>): WorkflowParam {
  return {
    name: raw.name as string,
    label: raw.label as string,
    type: raw.type as WorkflowParam["type"],
    ...(raw.required !== undefined && { required: raw.required as boolean }),
    ...(raw.default !== undefined && { default: raw.default as string }),
    ...(raw.options !== undefined && { options: raw.options as string[] }),
  };
}

// ── loadYamlWorkflow ──────────────────────────────────────────────────────────

/**
 * Parse a single YAML workflow file and return a LoadedWorkflow.
 * Throws on file-not-found, invalid YAML, or missing required fields.
 */
export function loadYamlWorkflow(filePath: string): LoadedWorkflow {
  const resolvedPath = path.resolve(filePath);
  const raw = fs.readFileSync(resolvedPath, "utf8");

  const doc = yaml.load(raw) as Record<string, unknown>;

  if (!doc.name || typeof doc.name !== "string") {
    throw new Error(`Workflow file ${resolvedPath} is missing required field: name`);
  }

  if (!Array.isArray(doc.steps) || doc.steps.length === 0) {
    throw new Error(`Workflow file ${resolvedPath} is missing required field: steps (must be a non-empty array)`);
  }

  const id = path.basename(resolvedPath).replace(/\.ya?ml$/i, "");

  const steps: WorkflowStep[] = (doc.steps as Record<string, unknown>[]).map(mapStep);

  const params: WorkflowParam[] | undefined = Array.isArray(doc.params)
    ? (doc.params as Record<string, unknown>[]).map(mapParam)
    : undefined;

  return {
    id,
    name: doc.name,
    ...(doc.description !== undefined && { description: doc.description as string }),
    ...(doc.icon !== undefined && { icon: doc.icon as string }),
    ...(doc.tags !== undefined && { tags: doc.tags as string[] }),
    ...(doc.env !== undefined && { env: doc.env as Record<string, string> }),
    ...(params !== undefined && { params }),
    steps,
    source: "yaml",
    file_path: resolvedPath,
  };
}

// ── loadAllYamlWorkflows ──────────────────────────────────────────────────────

/**
 * Load all .yml / .yaml files from a directory.
 * Returns an empty array if the directory does not exist.
 * Logs errors and continues if individual files fail to parse.
 */
export function loadAllYamlWorkflows(dir: string): LoadedWorkflow[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir);
  const yamlFiles = entries.filter((f) => /\.ya?ml$/i.test(f));

  const results: LoadedWorkflow[] = [];

  for (const file of yamlFiles) {
    const filePath = path.join(dir, file);
    try {
      results.push(loadYamlWorkflow(filePath));
    } catch (err) {
      console.error(`[yaml-loader] Failed to load ${filePath}:`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}
