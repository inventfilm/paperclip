import type { CostSummary } from "@paperclip/shared";
import { api } from "./client";

export interface CostByEntity {
  agentId?: string | null;
  projectId?: string | null;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

export const costsApi = {
  summary: (companyId: string) => api.get<CostSummary>(`/companies/${companyId}/costs/summary`),
  byAgent: (companyId: string) =>
    api.get<CostByEntity[]>(`/companies/${companyId}/costs/by-agent`),
  byProject: (companyId: string) =>
    api.get<CostByEntity[]>(`/companies/${companyId}/costs/by-project`),
};
