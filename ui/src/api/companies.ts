import type { Company } from "@paperclip/shared";
import { api } from "./client";

export const companiesApi = {
  list: () => api.get<Company[]>("/companies"),
  get: (companyId: string) => api.get<Company>(`/companies/${companyId}`),
  create: (data: { name: string; description?: string | null; budgetMonthlyCents?: number }) =>
    api.post<Company>("/companies", data),
  update: (
    companyId: string,
    data: Partial<Pick<Company, "name" | "description" | "status" | "budgetMonthlyCents">>,
  ) => api.patch<Company>(`/companies/${companyId}`, data),
  archive: (companyId: string) => api.post<Company>(`/companies/${companyId}/archive`, {}),
};
