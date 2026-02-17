import type { HeartbeatRun } from "@paperclip/shared";
import { api } from "./client";

export const heartbeatsApi = {
  list: (companyId: string, agentId?: string) => {
    const params = agentId ? `?agentId=${agentId}` : "";
    return api.get<HeartbeatRun[]>(`/companies/${companyId}/heartbeat-runs${params}`);
  },
};
