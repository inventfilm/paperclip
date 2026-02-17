import { useCallback } from "react";
import { agentsApi } from "../api/agents";
import { useApi } from "./useApi";

export function useAgents(companyId: string | null) {
  const fetcher = useCallback(() => {
    if (!companyId) return Promise.resolve([]);
    return agentsApi.list(companyId);
  }, [companyId]);
  return useApi(fetcher);
}
