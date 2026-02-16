import type { Issue } from "@paperclip/shared";
import { api } from "./client";

export const issuesApi = {
  list: () => api.get<Issue[]>("/issues"),
  get: (id: string) => api.get<Issue>(`/issues/${id}`),
  create: (data: Partial<Issue>) => api.post<Issue>("/issues", data),
  update: (id: string, data: Partial<Issue>) => api.patch<Issue>(`/issues/${id}`, data),
  remove: (id: string) => api.delete<Issue>(`/issues/${id}`),
};
