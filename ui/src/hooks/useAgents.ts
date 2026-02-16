import { useCallback } from "react";
import { agentsApi } from "../api/agents";
import { useApi } from "./useApi";

export function useAgents() {
  const fetcher = useCallback(() => agentsApi.list(), []);
  return useApi(fetcher);
}
