import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProcessManager } from "../core/process-manager.js";

describe("ProcessManager", () => {
  let pm: ProcessManager;

  beforeEach(() => {
    pm = new ProcessManager();
  });

  afterEach(() => {
    pm.killAll();
  });

  describe("spawn", () => {
    it("runs a command and returns exitCode 0 with stdout", async () => {
      const result = await pm.spawn({
        command: 'echo "hello world"',
        type: "run-and-done",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("hello world");
      expect(result.timedOut).toBe(false);
    });

    it("captures stderr output", async () => {
      const result = await pm.spawn({
        command: 'echo "error message" >&2',
        type: "run-and-done",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("error message");
    });

    it("returns non-zero exit codes", async () => {
      const result = await pm.spawn({
        command: "exit 1",
        type: "run-and-done",
      });

      expect(result.exitCode).toBe(1);
    });

    it("handles timeout and sets timedOut to true", async () => {
      const result = await pm.spawn({
        command: "sleep 60",
        type: "run-and-done",
        timeout: 1,
      });

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBeNull();
    }, 5000);

    it("calls onStdout callback with data chunks", async () => {
      const chunks: string[] = [];

      await pm.spawn({
        command: 'echo "hello"',
        type: "run-and-done",
        onStdout: (data) => chunks.push(data),
      });

      expect(chunks.join("")).toContain("hello");
    });

    it("calls onStderr callback with data chunks", async () => {
      const chunks: string[] = [];

      await pm.spawn({
        command: 'echo "err" >&2',
        type: "run-and-done",
        onStderr: (data) => chunks.push(data),
      });

      expect(chunks.join("")).toContain("err");
    });

    it("calls onExit callback when process finishes", async () => {
      let exitCode: number | null = null;

      await pm.spawn({
        command: "exit 42",
        type: "run-and-done",
        onExit: (code) => {
          exitCode = code;
        },
      });

      expect(exitCode).toBe(42);
    });

    it("removes process from registry after completion", async () => {
      await pm.spawn({
        command: "echo done",
        type: "run-and-done",
      });

      expect(pm.count()).toBe(0);
    });
  });

  describe("spawnBackground", () => {
    it("returns a handle with id, pid, and pgid", () => {
      const handle = pm.spawnBackground({
        command: "sleep 30",
        type: "long-running",
      });

      expect(handle.id).toBeDefined();
      expect(typeof handle.id).toBe("string");
      expect(handle.pid).toBeGreaterThan(0);
      expect(handle.pgid).toBeGreaterThan(0);
    });

    it("shows background process in getRunning()", () => {
      const handle = pm.spawnBackground({
        command: "sleep 30",
        type: "long-running",
      });

      const running = pm.getRunning();
      expect(running.length).toBe(1);
      expect(running[0].id).toBe(handle.id);
      expect(running[0].pid).toBe(handle.pid);
    });

    it("increments count after spawnBackground", () => {
      pm.spawnBackground({ command: "sleep 30", type: "daemon" });
      pm.spawnBackground({ command: "sleep 30", type: "daemon" });

      expect(pm.count()).toBe(2);
    });

    it("wires stdout callback for background process", async () => {
      const chunks: string[] = [];

      pm.spawnBackground({
        command: 'echo "bg output"',
        type: "run-and-done",
        onStdout: (data) => chunks.push(data),
      });

      // Give it time to emit
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(chunks.join("")).toContain("bg output");
    });
  });

  describe("kill", () => {
    it("kills a specific process by id and returns true", () => {
      const handle = pm.spawnBackground({
        command: "sleep 30",
        type: "long-running",
      });

      const result = pm.kill(handle.id);
      expect(result).toBe(true);
    });

    it("returns false for unknown id", () => {
      const result = pm.kill("nonexistent-id");
      expect(result).toBe(false);
    });

    it("removes process from registry after kill", () => {
      const handle = pm.spawnBackground({
        command: "sleep 30",
        type: "long-running",
      });

      pm.kill(handle.id);
      expect(pm.count()).toBe(0);
    });
  });

  describe("killAll", () => {
    it("kills all tracked processes and clears registry", () => {
      pm.spawnBackground({ command: "sleep 30", type: "daemon" });
      pm.spawnBackground({ command: "sleep 30", type: "daemon" });
      pm.spawnBackground({ command: "sleep 30", type: "daemon" });

      expect(pm.count()).toBe(3);
      pm.killAll();
      expect(pm.count()).toBe(0);
    });

    it("getRunning returns empty after killAll", () => {
      pm.spawnBackground({ command: "sleep 30", type: "daemon" });

      pm.killAll();
      expect(pm.getRunning()).toHaveLength(0);
    });
  });

  describe("getRunning", () => {
    it("returns correct shape for each entry", () => {
      const handle = pm.spawnBackground({
        command: "sleep 30",
        type: "long-running",
      });

      const running = pm.getRunning();
      expect(running).toHaveLength(1);

      const entry = running[0];
      expect(entry.id).toBe(handle.id);
      expect(entry.pid).toBe(handle.pid);
      expect(entry.type).toBe("long-running");
      expect(entry.command).toBe("sleep 30");
      expect(entry.started_at).toBeDefined();
    });

    it("returns empty array when no processes running", () => {
      expect(pm.getRunning()).toHaveLength(0);
    });
  });

  describe("count", () => {
    it("starts at 0", () => {
      expect(pm.count()).toBe(0);
    });

    it("tracks multiple background processes", () => {
      pm.spawnBackground({ command: "sleep 30", type: "daemon" });
      expect(pm.count()).toBe(1);
      pm.spawnBackground({ command: "sleep 30", type: "daemon" });
      expect(pm.count()).toBe(2);
    });
  });
});
