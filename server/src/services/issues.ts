import { eq } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { issues } from "@paperclip/db";

export function issueService(db: Db) {
  return {
    list: () => db.select().from(issues),

    getById: (id: string) =>
      db
        .select()
        .from(issues)
        .where(eq(issues.id, id))
        .then((rows) => rows[0] ?? null),

    create: (data: typeof issues.$inferInsert) =>
      db
        .insert(issues)
        .values(data)
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<typeof issues.$inferInsert>) =>
      db
        .update(issues)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(issues.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(issues)
        .where(eq(issues.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
