import { z } from "zod";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "../constants.js";

export const createIssueSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  goalId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(ISSUE_STATUSES).optional().default("backlog"),
  priority: z.enum(ISSUE_PRIORITIES).optional().default("medium"),
  assigneeAgentId: z.string().uuid().optional().nullable(),
  requestDepth: z.number().int().nonnegative().optional().default(0),
  billingCode: z.string().optional().nullable(),
});

export type CreateIssue = z.infer<typeof createIssueSchema>;

export const updateIssueSchema = createIssueSchema.partial().extend({
  comment: z.string().min(1).optional(),
});

export type UpdateIssue = z.infer<typeof updateIssueSchema>;

export const checkoutIssueSchema = z.object({
  agentId: z.string().uuid(),
  expectedStatuses: z.array(z.enum(ISSUE_STATUSES)).nonempty(),
});

export type CheckoutIssue = z.infer<typeof checkoutIssueSchema>;

export const addIssueCommentSchema = z.object({
  body: z.string().min(1),
});

export type AddIssueComment = z.infer<typeof addIssueCommentSchema>;
