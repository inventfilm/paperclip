import type { Agent, AgentKeyCreated, HeartbeatRun } from "@paperclip/shared";
import { api } from "./client";

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reports: OrgNode[];
}

export const agentsApi = {
  list: (companyId: string) => api.get<Agent[]>(`/companies/${companyId}/agents`),
  org: (companyId: string) => api.get<OrgNode[]>(`/companies/${companyId}/org`),
  get: (id: string) => api.get<Agent>(`/agents/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Agent>(`/companies/${companyId}/agents`, data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Agent>(`/agents/${id}`, data),
  pause: (id: string) => api.post<Agent>(`/agents/${id}/pause`, {}),
  resume: (id: string) => api.post<Agent>(`/agents/${id}/resume`, {}),
  terminate: (id: string) => api.post<Agent>(`/agents/${id}/terminate`, {}),
  createKey: (id: string, name: string) => api.post<AgentKeyCreated>(`/agents/${id}/keys`, { name }),
  invoke: (id: string) => api.post<HeartbeatRun>(`/agents/${id}/heartbeat/invoke`, {}),
};
