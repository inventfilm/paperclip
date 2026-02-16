import type { AgentRole, AgentStatus } from "../constants.js";

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  budgetCents: number;
  spentCents: number;
  lastHeartbeat: Date | null;
  reportsTo: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
