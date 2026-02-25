import { z } from "zod";
import { PROJECT_STATUSES } from "../constants.js";

export const createProjectSchema = z.object({
  /** @deprecated Use goalIds instead */
  goalId: z.string().uuid().optional().nullable(),
  goalIds: z.array(z.string().uuid()).optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional().default("backlog"),
  leadAgentId: z.string().uuid().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  archivedAt: z.string().datetime().optional().nullable(),
});

export type CreateProject = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial();

export type UpdateProject = z.infer<typeof updateProjectSchema>;

export const createProjectWorkspaceSchema = z.object({
  name: z.string().min(1),
  cwd: z.string().min(1),
  repoUrl: z.string().url().optional().nullable(),
  repoRef: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
});

export type CreateProjectWorkspace = z.infer<typeof createProjectWorkspaceSchema>;

export const updateProjectWorkspaceSchema = createProjectWorkspaceSchema.partial();

export type UpdateProjectWorkspace = z.infer<typeof updateProjectWorkspaceSchema>;
