import { spawn as nodeSpawn } from "child_process";
import { randomUUID } from "crypto";
import type { StepType } from "./types.js";

export interface SpawnOptions {
  command: string;
  type: StepType;
  workdir?: string;
  env?: Record<string, string>;
  timeout?: number; // seconds
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onExit?: (code: number | null) => void;
}

export interface SpawnResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ProcessHandle {
  id: string;
  pid: number;
  pgid: number;
}

interface TrackedEntry {
  id: string;
  pid: number;
  pgid: number;
  type: StepType;
  command: string;
  started_at: string;
  child: ReturnType<typeof nodeSpawn>;
}

export class ProcessManager {
  private registry = new Map<string, TrackedEntry>();

  spawn(opts: SpawnOptions): Promise<SpawnResult> {
    return new Promise((resolve) => {
      const id = randomUUID();
      const started_at = new Date().toISOString();

      const child = nodeSpawn("bash", ["-c", opts.command], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        cwd: opts.workdir,
        env: opts.env ? { ...process.env, ...opts.env } : process.env,
      });

      const pid = child.pid!;
      const pgid = pid; // detached process becomes its own process group leader

      const entry: TrackedEntry = {
        id,
        pid,
        pgid,
        type: opts.type,
        command: opts.command,
        started_at,
        child,
      };
      this.registry.set(id, entry);

      let stdoutBuf = "";
      let stderrBuf = "";
      let timedOut = false;
      let settled = false;

      child.stdout!.on("data", (chunk: Buffer) => {
        const str = chunk.toString();
        stdoutBuf += str;
        opts.onStdout?.(str);
      });

      child.stderr!.on("data", (chunk: Buffer) => {
        const str = chunk.toString();
        stderrBuf += str;
        opts.onStderr?.(str);
      });

      let timer: ReturnType<typeof setTimeout> | undefined;
      if (opts.timeout != null && opts.timeout > 0) {
        timer = setTimeout(() => {
          if (!settled) {
            timedOut = true;
            this._killEntry(entry);
          }
        }, opts.timeout * 1000);
      }

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        if (timer != null) clearTimeout(timer);
        this.registry.delete(id);
        opts.onExit?.(code);
        resolve({
          exitCode: timedOut ? null : code,
          stdout: stdoutBuf,
          stderr: stderrBuf,
          timedOut,
        });
      });

      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        if (timer != null) clearTimeout(timer);
        this.registry.delete(id);
        resolve({
          exitCode: null,
          stdout: stdoutBuf,
          stderr: stderrBuf + err.message,
          timedOut,
        });
      });
    });
  }

  spawnBackground(opts: SpawnOptions): ProcessHandle {
    const id = randomUUID();
    const started_at = new Date().toISOString();

    const child = nodeSpawn("bash", ["-c", opts.command], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: opts.workdir,
      env: opts.env ? { ...process.env, ...opts.env } : process.env,
    });

    const pid = child.pid!;
    const pgid = pid;

    const entry: TrackedEntry = {
      id,
      pid,
      pgid,
      type: opts.type,
      command: opts.command,
      started_at,
      child,
    };
    this.registry.set(id, entry);

    child.stdout!.on("data", (chunk: Buffer) => {
      opts.onStdout?.(chunk.toString());
    });

    child.stderr!.on("data", (chunk: Buffer) => {
      opts.onStderr?.(chunk.toString());
    });

    child.on("close", (code) => {
      opts.onExit?.(code);
      this.registry.delete(id);
    });

    child.on("error", () => {
      this.registry.delete(id);
    });

    return { id, pid, pgid };
  }

  kill(id: string): boolean {
    const entry = this.registry.get(id);
    if (!entry) return false;
    this._killEntry(entry);
    this.registry.delete(id);
    return true;
  }

  killAll(): void {
    for (const entry of this.registry.values()) {
      this._killEntry(entry);
    }
    this.registry.clear();
  }

  getRunning(): Array<{ id: string; pid: number; type: StepType; command: string; started_at: string }> {
    return Array.from(this.registry.values()).map(({ id, pid, type, command, started_at }) => ({
      id,
      pid,
      type,
      command,
      started_at,
    }));
  }

  count(): number {
    return this.registry.size;
  }

  private _killEntry(entry: TrackedEntry): void {
    try {
      // Kill the entire process group (negative PID) with SIGTERM
      process.kill(-entry.pid, "SIGTERM");
    } catch {
      // Process may already be gone; try SIGKILL as fallback
      try {
        process.kill(-entry.pid, "SIGKILL");
      } catch {
        // Ignore — process is gone
      }
    }
  }
}
