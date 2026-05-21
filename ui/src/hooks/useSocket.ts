import { useEffect } from "react";
import { getSocket } from "../socket";
import type { RunStatus, StepStatus } from "../types";

interface SocketCallbacks {
  onRunStatus?: (data: { run_id: string; status: RunStatus }) => void;
  onStepStatus?: (data: { run_id: string; step_index: number; status: StepStatus; exit_code?: number }) => void;
  onStepLog?: (data: { run_id: string; step_index: number; stream: "stdout" | "stderr"; content: string }) => void;
}

export function useSocket(callbacks: SocketCallbacks): void {
  useEffect(() => {
    const socket = getSocket();
    if (callbacks.onRunStatus) socket.on("run:status", callbacks.onRunStatus);
    if (callbacks.onStepStatus) socket.on("step:status", callbacks.onStepStatus);
    if (callbacks.onStepLog) socket.on("step:log", callbacks.onStepLog);
    return () => {
      if (callbacks.onRunStatus) socket.off("run:status", callbacks.onRunStatus);
      if (callbacks.onStepStatus) socket.off("step:status", callbacks.onStepStatus);
      if (callbacks.onStepLog) socket.off("step:log", callbacks.onStepLog);
    };
  }, [callbacks.onRunStatus, callbacks.onStepStatus, callbacks.onStepLog]);
}
