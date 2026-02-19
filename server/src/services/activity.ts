import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { activityLog, heartbeatRuns, issues } from "@paperclip/db";

export interface ActivityFilters {
  companyId: string;
  agentId?: string;
  entityType?: string;
  entityId?: string;
}

export function activityService(db: Db) {
  const issueIdAsText = sql<string>`${issues.id}::text`;
  return {
    list: (filters: ActivityFilters) => {
      const conditions = [eq(activityLog.companyId, filters.companyId)];

      if (filters.agentId) {
        conditions.push(eq(activityLog.agentId, filters.agentId));
      }
      if (filters.entityType) {
        conditions.push(eq(activityLog.entityType, filters.entityType));
      }
      if (filters.entityId) {
        conditions.push(eq(activityLog.entityId, filters.entityId));
      }

      return db.select().from(activityLog).where(and(...conditions)).orderBy(desc(activityLog.createdAt));
    },

    forIssue: (issueId: string) =>
      db
        .select()
        .from(activityLog)
        .where(
          and(
            eq(activityLog.entityType, "issue"),
            eq(activityLog.entityId, issueId),
          ),
        )
        .orderBy(desc(activityLog.createdAt)),

    runsForIssue: (issueId: string) =>
      db
        .selectDistinctOn([activityLog.runId], {
          runId: activityLog.runId,
          status: heartbeatRuns.status,
          agentId: heartbeatRuns.agentId,
          startedAt: heartbeatRuns.startedAt,
          finishedAt: heartbeatRuns.finishedAt,
          createdAt: heartbeatRuns.createdAt,
          invocationSource: heartbeatRuns.invocationSource,
        })
        .from(activityLog)
        .innerJoin(heartbeatRuns, eq(activityLog.runId, heartbeatRuns.id))
        .where(
          and(
            eq(activityLog.entityType, "issue"),
            eq(activityLog.entityId, issueId),
            isNotNull(activityLog.runId),
          ),
        )
        .orderBy(activityLog.runId, desc(heartbeatRuns.createdAt)),

    issuesForRun: (runId: string) =>
      db
        .selectDistinctOn([issueIdAsText], {
          issueId: issues.id,
          title: issues.title,
          status: issues.status,
          priority: issues.priority,
        })
        .from(activityLog)
        .innerJoin(issues, eq(activityLog.entityId, issueIdAsText))
        .where(
          and(
            eq(activityLog.runId, runId),
            eq(activityLog.entityType, "issue"),
          ),
        )
        .orderBy(issueIdAsText),

    create: (data: typeof activityLog.$inferInsert) =>
      db
        .insert(activityLog)
        .values(data)
        .returning()
        .then((rows) => rows[0]),
  };
}
