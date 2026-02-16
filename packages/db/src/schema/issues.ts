import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { projects } from "./projects.js";
import { goals } from "./goals.js";

export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"),
  priority: text("priority").notNull().default("medium"),
  projectId: uuid("project_id").references(() => projects.id),
  assigneeId: uuid("assignee_id").references(() => agents.id),
  goalId: uuid("goal_id").references(() => goals.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
