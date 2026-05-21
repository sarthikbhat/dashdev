import { useState, useEffect, useCallback } from "react";
import * as api from "../api";
import type { ServiceGroup } from "../types";

interface UseServiceGroupsResult {
  groups: ServiceGroup[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useServiceGroups(): UseServiceGroupsResult {
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listServiceGroups();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load service groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { groups, loading, error, refresh };
}
