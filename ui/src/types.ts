// Mirror of server/core/types.ts — keep in sync

export type StepType = "run-and-done" | "long-running" | "daemon";
export type OnFailure = "stop" | "continue" | `retry:${number}`;

export interface HealthCheck {
  url: string;
  interval: number;
  retries: number;
}

export interface WorkflowParam {
  name: string;
  label: string;
  type: "text" | "select" | "toggle";
  required?: boolean;
  default?: string;
  options?: string[];
}

export interface WorkflowStep {
  name: string;
  command: string;
  workdir?: string;
  type: StepType;
  timeout?: number;
  on_failure?: OnFailure;
  env?: Record<string, string>;
  health_check?: HealthCheck;
  outputs?: Record<string, string>;
}

export type WorkflowSource = "yaml" | "js" | "ui";

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tags?: string[];
  env?: Record<string, string>;
  params?: WorkflowParam[];
  steps: WorkflowStep[];
  source: WorkflowSource;
  file_path?: string;
  created_at: string;
  updated_at: string;
}

export type RunStatus = "running" | "completed" | "failed" | "cancelled" | "timed_out";
export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "skipped";

export interface Run {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: RunStatus;
  params_used: Record<string, string>;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
}

export interface RunWithSteps extends Run {
  steps: RunStep[];
}

export interface RunStep {
  id: string;
  run_id: string;
  step_index: number;
  name: string;
  command: string;
  type: StepType;
  status: StepStatus;
  exit_code?: number;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
}

export interface RunLog {
  id: string;
  run_step_id: string;
  stream: "stdout" | "stderr";
  content: string;
  timestamp: string;
}

export type ProcessStatus = "running" | "stopped" | "killed" | "crashed";

export interface TrackedProcess {
  id: string;
  run_step_id: string;
  pid: number;
  pgid: number;
  type: StepType;
  status: ProcessStatus;
  command: string;
  started_at: string;
  stopped_at?: string;
}

// Socket.io event shapes
export interface ServerToClientEvents {
  "run:status": (data: { run_id: string; status: RunStatus }) => void;
  "step:status": (data: {
    run_id: string;
    step_index: number;
    status: StepStatus;
    exit_code?: number;
  }) => void;
  "step:log": (data: {
    run_id: string;
    step_index: number;
    stream: "stdout" | "stderr";
    content: string;
  }) => void;
  "process:update": (data: { id: string; status: ProcessStatus }) => void;
}

export interface ClientToServerEvents {
  "run:cancel": (data: { run_id: string }) => void;
  "process:kill": (data: { id: string }) => void;
}

// Services
export type HealthCheckType = "port" | "http" | "command";
export type ServiceStatusType = "healthy" | "down" | "degraded";
export type ServiceCategory = "infra" | "app";

export interface Service {
  id: string;
  name: string;
  port: number;
  health_check_type: HealthCheckType;
  health_check_value?: string;
  start_command?: string;
  stop_command?: string;
  category: ServiceCategory;
  log_file?: string;
  created_at: string;
  updated_at: string;
  // Merged from health status
  status?: ServiceStatusType;
  detail?: string;
  uptime_since?: string;
  pid?: number;
}

export interface ServiceGroup {
  id: string;
  name: string;
  service_ids: string[];
  created_at: string;
}

export interface ServiceHealthStatus {
  service_id: string;
  status: ServiceStatusType;
  detail: string;
  last_checked: string;
  uptime_since?: string;
  pid?: number;
}
