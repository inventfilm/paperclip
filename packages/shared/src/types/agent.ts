import type {
  AgentAdapterType,
  AgentRole,
  AgentStatus,
} from "../constants.js";

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: AgentRole;
  title: string | null;
  status: AgentStatus;
  reportsTo: string | null;
  capabilities: string | null;
  adapterType: AgentAdapterType;
  adapterConfig: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  lastHeartbeatAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentKeyCreated {
  id: string;
  name: string;
  token: string;
  createdAt: Date;
}
