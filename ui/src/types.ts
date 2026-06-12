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
  type: "text" | "textarea" | "select" | "toggle";
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
  branch_group?: string;
  branch_id?: string;
  branch_condition?: string;
}

export type WorkflowSource = "yaml" | "js" | "ui";

export interface FlowStep {
  id: string;
  name: string;
  command: string;
  workdir: string;
  timeout: string;
  onFail: "abort" | "retry" | "continue";
}

export interface FlowBranch {
  id: string;
  label: string;
  condition: string;
  steps: FlowStep[];
}

export interface FlowNode {
  id: string;
  type: "step" | "parallel";
  step?: FlowStep;
  branches?: FlowBranch[];
  conditionVar?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tags?: string[];
  env?: Record<string, string>;
  params?: WorkflowParam[];
  steps: WorkflowStep[];
  nodes?: FlowNode[];
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
  "service:status": (data: ServiceHealthStatus[]) => void;
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
  setup_command?: string;
  workdir?: string;
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

// ── Redis ─────────────────────────────────────────────────────────────────

export interface RedisInfo {
  version: string;
  connected_clients: number;
  used_memory_human: string;
  total_keys: number;
  uptime_seconds: number;
}

export interface RedisKeyInfo {
  key: string;
  type: string;
  ttl: number;
}

export interface RedisKeyDetail {
  key: string;
  type: string;
  value: any;
  ttl: number;
  size: number;
}

// ── GitHub / CI/CD ───────────────────────────────────────────────────────

export interface GitHubSettings {
  hasToken: boolean;
  tokenPreview: string | null;
  repos: string[];
}

export interface GitHubRepo {
  full_name: string;
  name: string;
  owner: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
}

export interface PRReview {
  user: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
  submitted_at: string;
}

export interface PRChecks {
  total: number;
  success: number;
  failure: number;
  pending: number;
}

export interface GitHubPR {
  repo: string;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  user: string;
  user_avatar: string;
  created_at: string;
  updated_at: string;
  head_branch: string;
  head_sha: string;
  base_branch: string;
  requested_reviewers: string[];
  labels: { name: string; color: string }[];
  html_url: string;
  additions: number;
  deletions: number;
  changed_files: number;
  reviews: PRReview[];
  checks: PRChecks | null;
}

export interface GitHubCIRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  branch: string;
  event: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
  actor: string;
  actor_avatar: string;
}

export interface GitHubDeployment {
  id: number;
  environment: string;
  ref: string;
  task: string;
  created_at: string;
  updated_at: string;
  creator: string;
  description: string | null;
}

export interface RepoSummary {
  repo: string;
  deployments: GitHubDeployment[];
  ciSummary: { total: number; success: number; failure: number; running: number };
}

export interface GitHubCIRunWithRepo extends GitHubCIRun {
  repo: string;
}

export interface GitHubStatusResponse {
  currentUser: string | null;
  repos: RepoSummary[];
  myPRs: GitHubPR[];
  reviewRequests: GitHubPR[];
  myCIRuns: GitHubCIRunWithRepo[];
  recentCIRuns: GitHubCIRunWithRepo[];
}

// ── Local Git ─────────────────────────────────────────────────────────────

export interface GitRepoStatus {
  path: string;
  name: string;
  branch?: string;
  changes?: { total: number; staged: number; unstaged: number; untracked: number };
  ahead?: number;
  behind?: number;
  lastCommit?: {
    sha: string;
    message: string;
    author: string;
    relativeTime: string;
    timestamp: number;
  } | null;
  remoteUrl?: string | null;
  stashCount?: number;
  clean?: boolean;
  error?: string | null;
}
