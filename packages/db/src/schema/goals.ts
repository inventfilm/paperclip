import { type AnyPgColumn, pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  level: text("level").notNull().default("task"),
  parentId: uuid("parent_id").references((): AnyPgColumn => goals.id),
  ownerId: uuid("owner_id").references(() => agents.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
