import { z } from "zod";
import { AGENT_ROLES, AGENT_STATUSES } from "../constants.js";

export const createAgentSchema = z.object({
  name: z.string().min(1),
  role: z.enum(AGENT_ROLES),
  budgetCents: z.number().int().nonnegative().optional().default(0),
  reportsTo: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type CreateAgent = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = createAgentSchema
  .partial()
  .extend({
    status: z.enum(AGENT_STATUSES).optional(),
  });

export type UpdateAgent = z.infer<typeof updateAgentSchema>;
