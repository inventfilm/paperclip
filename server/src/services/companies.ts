import { eq } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { companies } from "@paperclip/db";

export function companyService(db: Db) {
  return {
    list: () => db.select().from(companies),

    getById: (id: string) =>
      db
        .select()
        .from(companies)
        .where(eq(companies.id, id))
        .then((rows) => rows[0] ?? null),

    create: (data: typeof companies.$inferInsert) =>
      db
        .insert(companies)
        .values(data)
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<typeof companies.$inferInsert>) =>
      db
        .update(companies)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(companies.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    archive: (id: string) =>
      db
        .update(companies)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(companies.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
