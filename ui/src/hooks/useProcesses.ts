import { useState, useEffect, useCallback } from "react";
import * as api from "../api";
import type { TrackedProcess } from "../types";

interface UseProcessesResult {
  processes: TrackedProcess[];
  refresh: () => Promise<void>;
  kill: (id: string) => Promise<void>;
}

export function useProcesses(): UseProcessesResult {
  const [processes, setProcesses] = useState<TrackedProcess[]>([]);

  const refresh = useCallback(async () => {
    const data = await api.listProcesses();
    setProcesses(data);
  }, []);

  const kill = useCallback(async (id: string) => {
    await api.killProcess(id);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { processes, refresh, kill };
}
