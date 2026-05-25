# DevDash Roadmap

## Current State (v0.1)
- Workflow engine (YAML + JS, sequential steps, params, live logs)
- Services health dashboard (13 services, groups, start/stop, health checks)
- Landing page, editor, run history

## Phase 1: Hardening (Next)

### Port Collision Resolution
When starting a service and the port is occupied, detect the rogue PID, show it, offer one-click kill + restart.

### Deep Health Checks
Extend health check to report more than just "up/down" — DB connection, cache status, memory. Requires `/health` endpoints in services.

### Fix Service Start Reliability
- rbenv/nvm/sdkman auto-detection per service
- Log capture from started services (pipe stdout/stderr to log files)
- Start failure reason surfaced in UI

## Phase 2: DAG Workflows
- Dependency graphs between steps (parallel execution)
- Visualize critical path and bottlenecks
- Step outputs as inputs to downstream steps

## Phase 3: IDE Bridge (MCP Server)
- Build an MCP server that exposes DevDash to VS Code / Cursor
- Service status, logs, workflow triggers from editor
- Zero tab-switching

## Phase 4: Environment Manager
- Toggle between Local / Staging / Prod-Mirror env profiles
- Auto-inject correct .env vars when starting services
- Sync secrets from vault / cloud provider

## Phase 5: PR & CI/CD Aggregation
- Show GitHub Actions status for current branch
- PR review blockers
- Deployment links
- Single source of truth for "what's the state of my code"

## Phase 6: Local Telemetry
- Bundle size tracking
- Render performance profiling
- Unhandled promise rejection capture
- Memory/CPU per service over time

---

**Prioritization rule:** Whatever terminal command you type most often this week = next feature.
