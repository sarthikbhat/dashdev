import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ServiceMonitor } from "../core/service-monitor.js";

// Minimal service definition used across tests
const makeService = (overrides: Partial<Parameters<typeof makeDef>[0]> = {}) =>
  makeDef({ id: "svc-1", name: "Test Service", port: 9999, health_check_type: "port", ...overrides });

function makeDef(def: {
  id: string;
  name: string;
  port: number;
  health_check_type: "port" | "http" | "command";
  health_check_value?: string;
}) {
  return def;
}

describe("ServiceMonitor", () => {
  let monitor: ServiceMonitor;

  afterEach(() => {
    monitor?.stop();
  });

  describe("construction", () => {
    it("can be constructed with a getServices callback", () => {
      monitor = new ServiceMonitor(() => []);
      expect(monitor).toBeDefined();
    });

    it("can be constructed with a getServices callback and onUpdate handler", () => {
      const onUpdate = vi.fn();
      monitor = new ServiceMonitor(() => [], onUpdate);
      expect(monitor).toBeDefined();
    });
  });

  describe("getStatus before poll", () => {
    it("returns empty array before first poll", () => {
      monitor = new ServiceMonitor(() => [makeService()]);
      expect(monitor.getStatus()).toEqual([]);
    });

    it("getServiceStatus returns undefined before first poll", () => {
      monitor = new ServiceMonitor(() => [makeService()]);
      expect(monitor.getServiceStatus("svc-1")).toBeUndefined();
    });
  });

  describe("stop", () => {
    it("can be stopped without having started", () => {
      monitor = new ServiceMonitor(() => []);
      expect(() => monitor.stop()).not.toThrow();
    });

    it("can be stopped after start", () => {
      monitor = new ServiceMonitor(() => []);
      monitor.start(60_000); // long interval so it only fires once
      expect(() => monitor.stop()).not.toThrow();
    });
  });

  describe("poll — port check", () => {
    it("marks a closed port as down", async () => {
      // Port 19999 is almost certainly not listening
      const svc = makeService({ id: "closed", port: 19999, health_check_type: "port" });
      monitor = new ServiceMonitor(() => [svc]);

      monitor.start(60_000);
      // Give the initial poll time to complete
      await new Promise((r) => setTimeout(r, 3500));

      const result = monitor.getServiceStatus("closed");
      expect(result).toBeDefined();
      expect(result!.service_id).toBe("closed");
      expect(result!.status).toBe("down");
      expect(result!.last_checked).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }, 10_000);

    it("populates statuses after poll", async () => {
      const svc = makeService({ id: "svc-a", port: 19998, health_check_type: "port" });
      monitor = new ServiceMonitor(() => [svc]);

      monitor.start(60_000);
      await new Promise((r) => setTimeout(r, 3500));

      expect(monitor.getStatus()).toHaveLength(1);
      expect(monitor.getStatus()[0].service_id).toBe("svc-a");
    }, 10_000);
  });

  describe("poll — command check", () => {
    it("marks a successful command as healthy", async () => {
      const svc = makeService({
        id: "cmd-healthy",
        port: 0,
        health_check_type: "command",
        health_check_value: "echo alive",
      });
      monitor = new ServiceMonitor(() => [svc]);

      monitor.start(60_000);
      await new Promise((r) => setTimeout(r, 1500));

      const result = monitor.getServiceStatus("cmd-healthy");
      expect(result).toBeDefined();
      expect(result!.status).toBe("healthy");
      expect(result!.detail).toContain("alive");
    }, 8_000);

    it("marks a failing command as down", async () => {
      const svc = makeService({
        id: "cmd-down",
        port: 0,
        health_check_type: "command",
        health_check_value: "exit 1",
      });
      monitor = new ServiceMonitor(() => [svc]);

      monitor.start(60_000);
      await new Promise((r) => setTimeout(r, 1500));

      const result = monitor.getServiceStatus("cmd-down");
      expect(result).toBeDefined();
      expect(result!.status).toBe("down");
    }, 8_000);
  });

  describe("onUpdate callback", () => {
    it("calls onUpdate with statuses after poll completes", async () => {
      const updates: unknown[] = [];
      const svc = makeService({
        id: "cb-svc",
        port: 19997,
        health_check_type: "command",
        health_check_value: "echo ok",
      });
      monitor = new ServiceMonitor(() => [svc], (statuses) => updates.push(statuses));

      monitor.start(60_000);
      await new Promise((r) => setTimeout(r, 1500));

      expect(updates.length).toBeGreaterThanOrEqual(1);
    }, 8_000);
  });

  describe("uptime tracking", () => {
    it("sets uptime_since when service is consistently healthy", async () => {
      const svc = makeService({
        id: "uptime-svc",
        port: 0,
        health_check_type: "command",
        health_check_value: "echo healthy",
      });
      monitor = new ServiceMonitor(() => [svc]);

      monitor.start(60_000);
      await new Promise((r) => setTimeout(r, 1500));

      const result = monitor.getServiceStatus("uptime-svc");
      expect(result?.uptime_since).toBeDefined();
      expect(result?.uptime_since).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }, 8_000);
  });

  describe("stale service cleanup", () => {
    it("removes status entries for services no longer returned by getServices", async () => {
      let services = [
        makeService({ id: "svc-keep", port: 0, health_check_type: "command", health_check_value: "echo ok" }),
        makeService({ id: "svc-remove", port: 0, health_check_type: "command", health_check_value: "echo ok" }),
      ];

      monitor = new ServiceMonitor(() => services);
      monitor.start(60_000);
      await new Promise((r) => setTimeout(r, 1500));

      expect(monitor.getStatus()).toHaveLength(2);

      // Remove one service from the list
      services = [makeService({ id: "svc-keep", port: 0, health_check_type: "command", health_check_value: "echo ok" })];

      // Manually trigger another poll via a short interval
      monitor.stop();
      monitor.start(60_000);
      await new Promise((r) => setTimeout(r, 1500));

      const ids = monitor.getStatus().map((s) => s.service_id);
      expect(ids).toContain("svc-keep");
      expect(ids).not.toContain("svc-remove");
    }, 15_000);
  });
});
