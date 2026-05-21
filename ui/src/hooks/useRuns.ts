import { useState, useEffect, useCallback } from "react";
import * as api from "../api";
import type { Run } from "../types";

interface UseRunsResult {
  runs: Run[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useRuns(workflowId?: string): UseRunsResult {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listRuns(workflowId);
      setRuns(data);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { runs, loading, refresh };
}
