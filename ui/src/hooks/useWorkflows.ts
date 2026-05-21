import { useState, useEffect, useCallback } from "react";
import * as api from "../api";
import type { Workflow } from "../types";

interface UseWorkflowsResult {
  workflows: Workflow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWorkflows(): UseWorkflowsResult {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listWorkflows();
      setWorkflows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { workflows, loading, error, refresh };
}
