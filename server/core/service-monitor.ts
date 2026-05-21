import { spawn } from "node:child_process";
import type { Service, ServiceHealthStatus } from "./types.js";

// Local aliases for convenience
type ServiceDef = Pick<Service, "id" | "name" | "port" | "health_check_type" | "health_check_value">;
type HealthResult = ServiceHealthStatus;

export class ServiceMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;
  private statuses = new Map<string, HealthResult>();
  private uptimeSince = new Map<string, string>(); // tracks when service was first seen healthy
  private getServices: () => ServiceDef[];
  private onUpdate?: (statuses: HealthResult[]) => void;

  constructor(
    getServices: () => ServiceDef[],
    onUpdate?: (statuses: HealthResult[]) => void
  ) {
    this.getServices = getServices;
    this.onUpdate = onUpdate;
  }

  start(intervalMs = 5000): void {
    // Run immediately, then on interval
    this.poll();
    this.interval = setInterval(() => this.poll(), intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getStatus(): HealthResult[] {
    return Array.from(this.statuses.values());
  }

  getServiceStatus(serviceId: string): HealthResult | undefined {
    return this.statuses.get(serviceId);
  }

  private async poll(): Promise<void> {
    const services = this.getServices();
    const results = await Promise.all(services.map((s) => this.checkService(s)));

    for (const result of results) {
      // Track uptime
      if (result.status === "healthy") {
        if (!this.uptimeSince.has(result.service_id)) {
          this.uptimeSince.set(result.service_id, result.last_checked);
        }
        result.uptime_since = this.uptimeSince.get(result.service_id);
      } else {
        this.uptimeSince.delete(result.service_id);
      }
      this.statuses.set(result.service_id, result);
    }

    // Remove statuses for services that no longer exist
    for (const id of this.statuses.keys()) {
      if (!services.some((s) => s.id === id)) {
        this.statuses.delete(id);
        this.uptimeSince.delete(id);
      }
    }

    this.onUpdate?.(this.getStatus());
  }

  private async checkService(service: ServiceDef): Promise<HealthResult> {
    const now = new Date().toISOString();
    try {
      switch (service.health_check_type) {
        case "port":
          return await this.checkPort(service, now);
        case "http":
          return await this.checkHttp(service, now);
        case "command":
          return await this.checkCommand(service, now);
        default:
          return await this.checkPort(service, now);
      }
    } catch {
      return { service_id: service.id, status: "down", detail: "check failed", last_checked: now };
    }
  }

  private checkPort(service: ServiceDef, now: string): Promise<HealthResult> {
    return new Promise((resolve) => {
      const child = spawn("lsof", ["-i", `:${service.port}`, "-sTCP:LISTEN"], { timeout: 3000 });
      let stdout = "";
      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      child.on("close", (code) => {
        if (code === 0 && stdout.trim()) {
          // Try to extract PID from lsof output
          const lines = stdout.trim().split("\n");
          const pidMatch = lines[1]?.match(/\S+\s+(\d+)/);
          const pid = pidMatch ? parseInt(pidMatch[1]) : undefined;
          resolve({
            service_id: service.id,
            status: "healthy",
            detail: `listening on :${service.port}`,
            last_checked: now,
            pid,
          });
        } else {
          resolve({
            service_id: service.id,
            status: "down",
            detail: `port ${service.port} closed`,
            last_checked: now,
          });
        }
      });
      child.on("error", () => {
        resolve({
          service_id: service.id,
          status: "down",
          detail: "port check failed",
          last_checked: now,
        });
      });
    });
  }

  private checkHttp(service: ServiceDef, now: string): Promise<HealthResult> {
    const url = service.health_check_value ?? `http://localhost:${service.port}`;
    return new Promise((resolve) => {
      const child = spawn(
        "curl",
        ["-sf", "--max-time", "3", "-o", "/dev/null", "-w", "%{http_code}", url],
        { timeout: 5000 }
      );
      let stdout = "";
      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      child.on("close", () => {
        const httpCode = stdout.trim();
        if (httpCode && httpCode !== "000") {
          resolve({
            service_id: service.id,
            status: "healthy",
            detail: `HTTP ${httpCode}`,
            last_checked: now,
          });
        } else {
          resolve({
            service_id: service.id,
            status: "down",
            detail: "not responding",
            last_checked: now,
          });
        }
      });
      child.on("error", () => {
        resolve({
          service_id: service.id,
          status: "down",
          detail: "http check failed",
          last_checked: now,
        });
      });
    });
  }

  private checkCommand(service: ServiceDef, now: string): Promise<HealthResult> {
    const cmd = service.health_check_value ?? `lsof -i :${service.port} -sTCP:LISTEN`;
    return new Promise((resolve) => {
      const child = spawn("bash", ["-c", cmd], { timeout: 5000 });
      let stdout = "";
      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      child.on("close", (code) => {
        if (code === 0) {
          const detail = stdout.trim().split("\n")[0]?.slice(0, 60) || "OK";
          resolve({ service_id: service.id, status: "healthy", detail, last_checked: now });
        } else {
          resolve({
            service_id: service.id,
            status: "down",
            detail: "command failed",
            last_checked: now,
          });
        }
      });
      child.on("error", () => {
        resolve({
          service_id: service.id,
          status: "down",
          detail: "command error",
          last_checked: now,
        });
      });
    });
  }
}
