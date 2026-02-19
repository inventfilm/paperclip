import type {
  Agent,
  AgentKeyCreated,
  AgentRuntimeState,
  HeartbeatRun,
  Approval,
  AgentConfigRevision,
} from "@paperclip/shared";
import { api } from "./client";

export interface AgentKey {
  id: string;
  name: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface AdapterModel {
  id: string;
  label: string;
}

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reports: OrgNode[];
}

export interface AgentHireResponse {
  agent: Agent;
  approval: Approval | null;
}

export const agentsApi = {
  list: (companyId: string) => api.get<Agent[]>(`/companies/${companyId}/agents`),
  org: (companyId: string) => api.get<OrgNode[]>(`/companies/${companyId}/org`),
  listConfigurations: (companyId: string) =>
    api.get<Record<string, unknown>[]>(`/companies/${companyId}/agent-configurations`),
  get: (id: string) => api.get<Agent>(`/agents/${id}`),
  getConfiguration: (id: string) => api.get<Record<string, unknown>>(`/agents/${id}/configuration`),
  listConfigRevisions: (id: string) =>
    api.get<AgentConfigRevision[]>(`/agents/${id}/config-revisions`),
  getConfigRevision: (id: string, revisionId: string) =>
    api.get<AgentConfigRevision>(`/agents/${id}/config-revisions/${revisionId}`),
  rollbackConfigRevision: (id: string, revisionId: string) =>
    api.post<Agent>(`/agents/${id}/config-revisions/${revisionId}/rollback`, {}),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Agent>(`/companies/${companyId}/agents`, data),
  hire: (companyId: string, data: Record<string, unknown>) =>
    api.post<AgentHireResponse>(`/companies/${companyId}/agent-hires`, data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Agent>(`/agents/${id}`, data),
  updatePermissions: (id: string, data: { canCreateAgents: boolean }) =>
    api.patch<Agent>(`/agents/${id}/permissions`, data),
  pause: (id: string) => api.post<Agent>(`/agents/${id}/pause`, {}),
  resume: (id: string) => api.post<Agent>(`/agents/${id}/resume`, {}),
  terminate: (id: string) => api.post<Agent>(`/agents/${id}/terminate`, {}),
  remove: (id: string) => api.delete<{ ok: true }>(`/agents/${id}`),
  listKeys: (id: string) => api.get<AgentKey[]>(`/agents/${id}/keys`),
  createKey: (id: string, name: string) => api.post<AgentKeyCreated>(`/agents/${id}/keys`, { name }),
  revokeKey: (agentId: string, keyId: string) => api.delete<{ ok: true }>(`/agents/${agentId}/keys/${keyId}`),
  runtimeState: (id: string) => api.get<AgentRuntimeState>(`/agents/${id}/runtime-state`),
  resetSession: (id: string) => api.post<void>(`/agents/${id}/runtime-state/reset-session`, {}),
  adapterModels: (type: string) => api.get<AdapterModel[]>(`/adapters/${type}/models`),
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
