import { eq } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { projects } from "@paperclip/db";

export function projectService(db: Db) {
  return {
    list: (companyId: string) => db.select().from(projects).where(eq(projects.companyId, companyId)),

    getById: (id: string) =>
      db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .then((rows) => rows[0] ?? null),

    create: (companyId: string, data: Omit<typeof projects.$inferInsert, "companyId">) =>
      db
        .insert(projects)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<typeof projects.$inferInsert>) =>
      db
        .update(projects)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(projects)
        .where(eq(projects.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
