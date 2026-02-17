import type { ActivityEvent } from "@paperclip/shared";
import { api } from "./client";

export const activityApi = {
  list: (companyId: string) => api.get<ActivityEvent[]>(`/companies/${companyId}/activity`),
};
