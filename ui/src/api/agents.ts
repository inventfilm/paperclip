import type { Agent, AgentKeyCreated, AgentRuntimeState, HeartbeatRun } from "@paperclip/shared";
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
  runtimeState: (id: string) => api.get<AgentRuntimeState>(`/agents/${id}/runtime-state`),
  resetSession: (id: string) => api.post<void>(`/agents/${id}/runtime-state/reset-session`, {}),
  invoke: (id: string) => api.post<HeartbeatRun>(`/agents/${id}/heartbeat/invoke`, {}),
  wakeup: (
    id: string,
    data: {
      source?: "timer" | "assignment" | "on_demand" | "automation";
      triggerDetail?: "manual" | "ping" | "callback" | "system";
      reason?: string | null;
      payload?: Record<string, unknown> | null;
      idempotencyKey?: string | null;
    },
  ) => api.post<HeartbeatRun | { status: "skipped" }>(`/agents/${id}/wakeup`, data),
};
