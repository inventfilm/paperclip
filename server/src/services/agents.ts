import { eq } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { agents } from "@paperclip/db";

export function agentService(db: Db) {
  return {
    list: () => db.select().from(agents),

    getById: (id: string) =>
      db
        .select()
        .from(agents)
        .where(eq(agents.id, id))
        .then((rows) => rows[0] ?? null),

    create: (data: typeof agents.$inferInsert) =>
      db
        .insert(agents)
        .values(data)
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<typeof agents.$inferInsert>) =>
      db
        .update(agents)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(agents.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(agents)
        .where(eq(agents.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
