import { type AnyPgColumn, pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  role: text("role").notNull().default("general"),
  status: text("status").notNull().default("idle"),
  budgetCents: integer("budget_cents").notNull().default(0),
  spentCents: integer("spent_cents").notNull().default(0),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
  reportsTo: uuid("reports_to").references((): AnyPgColumn => agents.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
