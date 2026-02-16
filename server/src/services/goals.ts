import { eq } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { goals } from "@paperclip/db";

export function goalService(db: Db) {
  return {
    list: () => db.select().from(goals),

    getById: (id: string) =>
      db
        .select()
        .from(goals)
        .where(eq(goals.id, id))
        .then((rows) => rows[0] ?? null),

    create: (data: typeof goals.$inferInsert) =>
      db
        .insert(goals)
        .values(data)
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<typeof goals.$inferInsert>) =>
      db
        .update(goals)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(goals.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(goals)
        .where(eq(goals.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
