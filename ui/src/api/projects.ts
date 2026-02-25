import type { Project, ProjectWorkspace } from "@paperclip/shared";
import { api } from "./client";

export const projectsApi = {
  list: (companyId: string) => api.get<Project[]>(`/companies/${companyId}/projects`),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Project>(`/companies/${companyId}/projects`, data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Project>(`/projects/${id}`, data),
  listWorkspaces: (projectId: string) =>
    api.get<ProjectWorkspace[]>(`/projects/${projectId}/workspaces`),
  createWorkspace: (projectId: string, data: Record<string, unknown>) =>
    api.post<ProjectWorkspace>(`/projects/${projectId}/workspaces`, data),
  updateWorkspace: (projectId: string, workspaceId: string, data: Record<string, unknown>) =>
    api.patch<ProjectWorkspace>(`/projects/${projectId}/workspaces/${workspaceId}`, data),
  removeWorkspace: (projectId: string, workspaceId: string) =>
    api.delete<ProjectWorkspace>(`/projects/${projectId}/workspaces/${workspaceId}`),
  remove: (id: string) => api.delete<Project>(`/projects/${id}`),
};
