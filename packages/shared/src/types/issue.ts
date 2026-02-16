import type { IssuePriority, IssueStatus } from "../constants.js";

export interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  projectId: string | null;
  assigneeId: string | null;
  goalId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
