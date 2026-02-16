import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { activityLog } from "@paperclip/db";

export interface ActivityFilters {
  agentId?: string;
  entityType?: string;
  entityId?: string;
}

export function activityService(db: Db) {
  return {
    list: (filters?: ActivityFilters) => {
      const conditions = [];

      if (filters?.agentId) {
        conditions.push(eq(activityLog.agentId, filters.agentId));
      }
      if (filters?.entityType) {
        conditions.push(eq(activityLog.entityType, filters.entityType));
      }
      if (filters?.entityId) {
        conditions.push(eq(activityLog.entityId, filters.entityId));
      }

      const query = db.select().from(activityLog);

      if (conditions.length > 0) {
        return query.where(and(...conditions)).orderBy(desc(activityLog.createdAt));
      }

      return query.orderBy(desc(activityLog.createdAt));
    },

    create: (data: typeof activityLog.$inferInsert) =>
      db
        .insert(activityLog)
        .values(data)
        .returning()
        .then((rows) => rows[0]),
  };
}
