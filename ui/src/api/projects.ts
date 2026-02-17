import type { Project } from "@paperclip/shared";
import { api } from "./client";

export const projectsApi = {
  list: (companyId: string) => api.get<Project[]>(`/companies/${companyId}/projects`),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Project>(`/companies/${companyId}/projects`, data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Project>(`/projects/${id}`, data),
  remove: (id: string) => api.delete<Project>(`/projects/${id}`),
};
