import type { Project } from "@paperclip/shared";
import { api } from "./client";

export const projectsApi = {
  list: () => api.get<Project[]>("/projects"),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: Partial<Project>) => api.post<Project>("/projects", data),
  update: (id: string, data: Partial<Project>) => api.patch<Project>(`/projects/${id}`, data),
  remove: (id: string) => api.delete<Project>(`/projects/${id}`),
};
