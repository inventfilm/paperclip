import { z } from "zod";
import {
  AGENT_ADAPTER_TYPES,
  AGENT_CONTEXT_MODES,
  AGENT_ROLES,
  AGENT_STATUSES,
} from "../constants.js";

export const createAgentSchema = z.object({
  name: z.string().min(1),
  role: z.enum(AGENT_ROLES).optional().default("general"),
  title: z.string().optional().nullable(),
  reportsTo: z.string().uuid().optional().nullable(),
  capabilities: z.string().optional().nullable(),
  adapterType: z.enum(AGENT_ADAPTER_TYPES).optional().default("process"),
  adapterConfig: z.record(z.unknown()).optional().default({}),
  contextMode: z.enum(AGENT_CONTEXT_MODES).optional().default("thin"),
  budgetMonthlyCents: z.number().int().nonnegative().optional().default(0),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type CreateAgent = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = createAgentSchema
  .partial()
  .extend({
    status: z.enum(AGENT_STATUSES).optional(),
    spentMonthlyCents: z.number().int().nonnegative().optional(),
  });

export type UpdateAgent = z.infer<typeof updateAgentSchema>;

export const createAgentKeySchema = z.object({
  name: z.string().min(1).default("default"),
});

export type CreateAgentKey = z.infer<typeof createAgentKeySchema>;
