import { useState, useEffect, useCallback, useRef } from "react";
import { getSocket } from "../socket";
import * as api from "../api";
import type { Service, ServiceHealthStatus } from "../types";

interface UseServicesResult {
  services: Service[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useServices(): UseServicesResult {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const servicesRef = useRef<Service[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listServices();
      setServices(data);
      servicesRef.current = data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Listen to service:status socket events
  useEffect(() => {
    const socket = getSocket();

    function handleStatus(statuses: ServiceHealthStatus[]) {
      const statusMap = new Map(statuses.map((s) => [s.service_id, s]));
      setServices((prev) => {
        const next = prev.map((svc) => {
          const st = statusMap.get(svc.id);
          if (!st) return svc;
          return {
            ...svc,
            status: st.status,
            detail: st.detail,
            uptime_since: st.uptime_since,
            pid: st.pid,
          };
        });
        servicesRef.current = next;
        return next;
      });
    }

    socket.on("service:status", handleStatus);
    return () => {
      socket.off("service:status", handleStatus);
    };
  }, []);

  return { services, loading, error, refresh };
}
