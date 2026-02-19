import type { Issue, IssueComment } from "@paperclip/shared";
import { api } from "./client";

export const issuesApi = {
  list: (companyId: string) => api.get<Issue[]>(`/companies/${companyId}/issues`),
  get: (id: string) => api.get<Issue>(`/issues/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Issue>(`/companies/${companyId}/issues`, data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Issue>(`/issues/${id}`, data),
  remove: (id: string) => api.delete<Issue>(`/issues/${id}`),
  checkout: (id: string, agentId: string) =>
    api.post<Issue>(`/issues/${id}/checkout`, {
      agentId,
      expectedStatuses: ["todo", "backlog", "blocked"],
    }),
  release: (id: string) => api.post<Issue>(`/issues/${id}/release`, {}),
  listComments: (id: string) => api.get<IssueComment[]>(`/issues/${id}/comments`),
  addComment: (id: string, body: string, reopen?: boolean) =>
    api.post<IssueComment>(`/issues/${id}/comments`, reopen === undefined ? { body } : { body, reopen }),
};
