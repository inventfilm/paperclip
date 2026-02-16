import { z } from "zod";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "../constants.js";

export const createIssueSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(ISSUE_STATUSES).optional().default("backlog"),
  priority: z.enum(ISSUE_PRIORITIES).optional().default("medium"),
  projectId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  goalId: z.string().uuid().optional().nullable(),
});

export type CreateIssue = z.infer<typeof createIssueSchema>;

export const updateIssueSchema = createIssueSchema.partial();

export type UpdateIssue = z.infer<typeof updateIssueSchema>;
