import type { Agent } from "@paperclip/shared";
import { api } from "./client";

export const agentsApi = {
  list: () => api.get<Agent[]>("/agents"),
  get: (id: string) => api.get<Agent>(`/agents/${id}`),
  create: (data: Partial<Agent>) => api.post<Agent>("/agents", data),
  update: (id: string, data: Partial<Agent>) => api.patch<Agent>(`/agents/${id}`, data),
  remove: (id: string) => api.delete<Agent>(`/agents/${id}`),
};
