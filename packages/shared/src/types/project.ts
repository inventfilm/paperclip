import type { ProjectStatus } from "../constants.js";

export interface ProjectGoalRef {
  id: string;
  title: string;
}

export interface Project {
  id: string;
  companyId: string;
  /** @deprecated Use goalIds / goals instead */
  goalId: string | null;
  goalIds: string[];
  goals: ProjectGoalRef[];
  name: string;
  description: string | null;
  status: ProjectStatus;
  leadAgentId: string | null;
  targetDate: string | null;
  color: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
