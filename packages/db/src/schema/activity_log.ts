import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
