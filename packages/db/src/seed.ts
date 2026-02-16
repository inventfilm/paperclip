import { eq, inArray } from "drizzle-orm";
import { createDb } from "./client.js";
import { agents, projects, issues, goals } from "./schema/index.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const db = createDb(url);

console.log("Seeding database...");

const [ceo, engineer, researcher] = await db
  .insert(agents)
  .values([
    { name: "CEO Agent", role: "ceo", status: "active" },
    { name: "Engineer Agent", role: "engineer", status: "idle" },
    { name: "Researcher Agent", role: "researcher", status: "idle" },
  ])
  .returning();

// Wire up reporting hierarchy: engineer and researcher report to CEO
await db
  .update(agents)
  .set({ reportsTo: ceo!.id })
  .where(inArray(agents.id, [engineer!.id, researcher!.id]));

const [project] = await db
  .insert(projects)
  .values([{ name: "Paperclip MVP", description: "Build the initial paperclip management platform" }])
  .returning();

const [goal] = await db
  .insert(goals)
  .values([
    {
      title: "Launch MVP",
      description: "Ship the minimum viable product",
      level: "milestone",
      ownerId: ceo!.id,
    },
  ])
  .returning();

await db.insert(issues).values([
  {
    title: "Set up database schema",
    description: "Create initial Drizzle schema with all core tables",
    status: "done",
    priority: "high",
    projectId: project!.id,
    assigneeId: engineer!.id,
    goalId: goal!.id,
  },
  {
    title: "Implement agent heartbeat",
    description: "Add periodic heartbeat mechanism for agent health monitoring",
    status: "in_progress",
    priority: "medium",
    projectId: project!.id,
    assigneeId: engineer!.id,
    goalId: goal!.id,
  },
]);

console.log("Seed complete");
process.exit(0);
