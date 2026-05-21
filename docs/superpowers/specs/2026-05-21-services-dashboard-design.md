# Services Health Dashboard

**Date:** 2026-05-21
**Status:** Approved

## Problem

Developers run many local services (MySQL, Redis, Kafka, app servers, etc.) and need to know at a glance what's running, what's down, and be able to start/stop/restart them without remembering individual commands.

## Solution

A Services page in DevDash that shows real-time health status of all configured local services, with start/stop/restart controls, group management, and log viewing.

## Navigation Changes

- `/` → Landing page with two cards: **Services** (default, highlighted) and **Workflows**
- `/services` → Services health dashboard
- `/workflows` → Workflow list (current Dashboard behavior, moved here)
- `/workflow/:id` → Workflow detail (unchanged)
- `/workflow/:id/edit` → Workflow editor (unchanged)
- `/history` → Run history (unchanged)

The sidebar content changes based on which section is active (services vs workflows).

## Data Model

### services table (SQLite)

```sql
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  port INTEGER NOT NULL,
  health_check_type TEXT NOT NULL DEFAULT 'port',  -- port | http | command
  health_check_value TEXT,  -- URL for http, command string for command, null for port
  start_command TEXT,
  stop_command TEXT,
  category TEXT DEFAULT 'app',  -- infra | app
  log_file TEXT,  -- optional path to log file
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### service_groups table (SQLite)

```sql
CREATE TABLE service_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  service_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array of service IDs
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### In-memory status (not persisted)

Polled every 5 seconds by the server:

```ts
interface ServiceStatus {
  service_id: string;
  status: "healthy" | "down" | "degraded";
  detail: string;       // e.g., "PONG", "HTTP 200", "connection refused"
  last_checked: string;  // ISO timestamp
  uptime_since?: string; // when it was first seen healthy
  pid?: number;          // if we can detect it
}
```

## Health Checking

Poll every 5 seconds. Three check types:

| Type | How | Example |
|------|-----|---------|
| `port` | `lsof -i :PORT -sTCP:LISTEN` | Any service with a known port |
| `http` | `GET url`, check for non-000 HTTP status | testhub `/ping`, obs-api `/actuator/health` |
| `command` | Run command, check exit code 0 | `redis-cli ping`, `mysql -u root -h 127.0.0.1 -e "SELECT 1"` |

Results broadcast to UI via socket.io event `service:status`.

## Start / Stop / Restart

- Start: runs `start_command` via ProcessManager.spawn() as a daemon process
- Stop: runs `stop_command` via ProcessManager.spawn(), or kills by port PID if no stop_command
- Restart: stop then start with 2s delay
- Group actions: iterate services in the group sequentially

All commands use the existing ProcessManager with process group tracking and cleanup.

## Logs

For services with a `log_file` configured:
- Tail last 200 lines on open
- Stream new lines via WebSocket (`service:log` event)
- Uses `tail -f` spawned through ProcessManager

For services started by DevDash:
- Stdout/stderr captured and streamed like workflow run logs

## Auto-Import from backendctl

A one-time "Import from backendctl" button on the empty state / services page:

1. Reads `~/Desktop/code/tm/backend/backendctl` file
2. Parses the `SERVICES` array to extract: name, port, category
3. Parses `app_cmd()`, `start_service()`, `stop_service()` to extract start/stop commands
4. Parses `health_check()` to extract health check type and details
5. Imports pre-defined groups: TM_SERVICES, TRA_SERVICES
6. Populates services and service_groups tables

This is best-effort parsing — the user can edit/fix after import.

## Add Service Form (new users)

Fields:
- **Name** (required) — e.g., "MySQL"
- **Port** (required) — e.g., 3306
- **Category** — infra or app (radio)
- **Health check type** — port / http / command (radio)
- **Health check value** — URL or command (shown based on type selection, hidden for port type)
- **Start command** — shell command to start the service
- **Stop command** — shell command to stop (or leave empty for port-based kill)
- **Log file path** — optional

## Create Group Form

Fields:
- **Name** (required) — e.g., "TM Stack"
- **Services** — multi-select checklist of all configured services

## API Endpoints

```
GET    /api/services              — list all services with current status
POST   /api/services              — create a service
PUT    /api/services/:id          — update a service
DELETE /api/services/:id          — delete a service

GET    /api/services/status       — get current health status of all services
POST   /api/services/:id/start    — start a service
POST   /api/services/:id/stop     — stop a service
POST   /api/services/:id/restart  — restart a service

GET    /api/services/:id/logs     — get recent logs (query: lines=200)

GET    /api/service-groups        — list all groups
POST   /api/service-groups        — create a group
PUT    /api/service-groups/:id    — update a group
DELETE /api/service-groups/:id    — delete a group
POST   /api/service-groups/:id/start  — start all services in group
POST   /api/service-groups/:id/stop   — stop all services in group

POST   /api/services/import-backendctl — auto-import from backendctl
```

## Socket Events

```ts
// Server → Client
"service:status": (data: ServiceStatus[]) => void;  // bulk status update every 5s
"service:log": (data: { service_id: string; content: string }) => void;

// Client → Server
"service:subscribe-logs": (data: { service_id: string }) => void;
"service:unsubscribe-logs": (data: { service_id: string }) => void;
```

## UI Layout

### Services Sidebar
- Section header: "Groups" with count + "New group" button
- Group list: clickable, filters main view. "All" is default.
- Divider
- Section header: "Services" (alphabetical)
- Service list: each shows colored dot (green/red) + name + port

### Services Main Area
- Page header: "Services Health" + "Add service" + "Import from backendctl" buttons
- Summary strip: "8/13 running | 5 down" with colored indicators
- Service cards grid or list: each card shows name, port, status badge, health detail, uptime, start/stop/restart buttons
- Clicking a service card expands to show logs panel below
- Group cards below: group name + member count + group start/stop buttons

### Landing Page (`/`)
Two large cards centered:
- **Services** card (default highlighted): icon, "Services", description "Monitor and manage local services", count of running/total
- **Workflows** card: icon, "Workflows", description "Run multi-step dev workflows", count of workflows

## Project Structure (new files)

```
server/
  api/services.ts          — REST endpoints for services + groups
  core/service-monitor.ts  — health polling loop, status management
  core/backendctl-parser.ts — parse backendctl script for auto-import

ui/src/
  pages/Landing.tsx         — the new / page with Services/Workflows cards
  pages/Services.tsx        — services health dashboard
  components/ServiceCard.tsx     — individual service with status + controls
  components/ServiceForm.tsx     — add/edit service form
  components/GroupForm.tsx       — create/edit group form
  components/ServiceSidebar.tsx  — groups + service list for services page
  components/ServiceLogPanel.tsx — log viewer for a service
  hooks/useServices.ts      — fetch services + status
  hooks/useServiceGroups.ts — fetch groups
```
