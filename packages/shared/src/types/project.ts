import type { ProjectStatus } from "../constants.js";

export interface Project {
  id: string;
  companyId: string;
  goalId: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  leadAgentId: string | null;
  targetDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}
