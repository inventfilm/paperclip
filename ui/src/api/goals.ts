import type { Goal } from "@paperclip/shared";
import { api } from "./client";

export const goalsApi = {
  list: () => api.get<Goal[]>("/goals"),
  get: (id: string) => api.get<Goal>(`/goals/${id}`),
  create: (data: Partial<Goal>) => api.post<Goal>("/goals", data),
  update: (id: string, data: Partial<Goal>) => api.patch<Goal>(`/goals/${id}`, data),
  remove: (id: string) => api.delete<Goal>(`/goals/${id}`),
};
