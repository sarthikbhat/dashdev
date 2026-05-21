import type {
  Workflow,
  Run,
  RunWithSteps,
  RunLog,
  TrackedProcess,
  WorkflowStep,
  WorkflowParam,
  Service,
  ServiceHealthStatus,
  ServiceGroup,
} from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Workflows ──────────────────────────────────────────────────────────────

export function listWorkflows(): Promise<Workflow[]> {
  return request<Workflow[]>("/workflows");
}

export function getWorkflow(id: string): Promise<Workflow> {
  return request<Workflow>(`/workflows/${id}`);
}

export interface SaveWorkflowBody {
  name: string;
  steps: WorkflowStep[];
  description?: string;
  icon?: string;
  tags?: string[];
  env?: Record<string, string>;
  params?: WorkflowParam[];
}

export function saveWorkflow(id: string, body: SaveWorkflowBody): Promise<Workflow> {
  return request<Workflow>(`/workflows/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteWorkflow(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/workflows/${id}`, { method: "DELETE" });
}

// ── Runs ───────────────────────────────────────────────────────────────────

export function triggerRun(
  workflow_id: string,
  params?: Record<string, string>
): Promise<{ run_id: string; workflow_id: string; status: string }> {
  return request<{ run_id: string; workflow_id: string; status: string }>("/runs", {
    method: "POST",
    body: JSON.stringify({ workflow_id, params }),
  });
}

export function listRuns(workflow_id?: string): Promise<Run[]> {
  const qs = workflow_id ? `?workflow_id=${encodeURIComponent(workflow_id)}` : "";
  return request<Run[]>(`/runs${qs}`);
}

export function getRun(id: string): Promise<RunWithSteps> {
  return request<RunWithSteps>(`/runs/${id}`);
}

export function getStepLogs(runId: string, stepId: string): Promise<RunLog[]> {
  return request<RunLog[]>(`/runs/${runId}/steps/${stepId}/logs`);
}

export function cancelRun(id: string): Promise<{ cancelled: boolean }> {
  return request<{ cancelled: boolean }>(`/runs/${id}/cancel`, { method: "POST" });
}

// ── Processes ──────────────────────────────────────────────────────────────

export function listProcesses(): Promise<TrackedProcess[]> {
  return request<TrackedProcess[]>("/processes");
}

export function killProcess(id: string): Promise<{ killed: boolean }> {
  return request<{ killed: boolean }>(`/processes/${id}/kill`, { method: "POST" });
}

// ── Health ─────────────────────────────────────────────────────────────────

export function health(): Promise<{ status: string; uptime: number }> {
  return request<{ status: string; uptime: number }>("/health");
}

// ── Services ───────────────────────────────────────────────────────────────

const fetchJson = <T>(path: string, init?: RequestInit): Promise<T> =>
  request<T>(path, init);

export const listServices = () => fetchJson<Service[]>("/services");
export const createService = (data: any) => fetchJson<{ id: string }>("/services", { method: "POST", body: JSON.stringify(data) });
export const updateService = (id: string, data: any) => fetchJson<void>(`/services/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteService = (id: string) => fetchJson<void>(`/services/${id}`, { method: "DELETE" });
export const getServicesStatus = () => fetchJson<ServiceHealthStatus[]>("/services/status");
export const startService = (id: string) => fetchJson<void>(`/services/${id}/start`, { method: "POST" });
export const stopService = (id: string) => fetchJson<void>(`/services/${id}/stop`, { method: "POST" });
export const restartService = (id: string) => fetchJson<void>(`/services/${id}/restart`, { method: "POST" });
export const getServiceLogs = (id: string) => fetchJson<{ lines: string[] }>(`/services/${id}/logs`);
export const listServiceGroups = () => fetchJson<ServiceGroup[]>("/services/groups");
export const createServiceGroup = (data: any) => fetchJson<{ id: string }>("/services/groups", { method: "POST", body: JSON.stringify(data) });
export const deleteServiceGroup = (id: string) => fetchJson<void>(`/services/groups/${id}`, { method: "DELETE" });
export const startServiceGroup = (id: string) => fetchJson<void>(`/services/groups/${id}/start`, { method: "POST" });
export const stopServiceGroup = (id: string) => fetchJson<void>(`/services/groups/${id}/stop`, { method: "POST" });
export const importBackendctl = (filePath: string) => fetchJson<{ imported: number }>("/services/import-backendctl", { method: "POST", body: JSON.stringify({ file_path: filePath }) });
