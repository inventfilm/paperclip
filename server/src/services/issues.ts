import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { issues, issueComments } from "@paperclip/db";
import { conflict, notFound, unprocessable } from "../errors.js";

const ISSUE_TRANSITIONS: Record<string, string[]> = {
  backlog: ["todo", "cancelled"],
  todo: ["in_progress", "blocked", "cancelled"],
  in_progress: ["in_review", "blocked", "done", "cancelled"],
  in_review: ["in_progress", "done", "cancelled"],
  blocked: ["todo", "in_progress", "cancelled"],
  done: [],
  cancelled: [],
};

function assertTransition(from: string, to: string) {
  if (from === to) return;
  const allowed = ISSUE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw conflict(`Invalid issue status transition: ${from} -> ${to}`);
  }
}

function applyStatusSideEffects(
  status: string | undefined,
  patch: Partial<typeof issues.$inferInsert>,
): Partial<typeof issues.$inferInsert> {
  if (!status) return patch;

  if (status === "in_progress" && !patch.startedAt) {
    patch.startedAt = new Date();
  }
  if (status === "done") {
    patch.completedAt = new Date();
  }
  if (status === "cancelled") {
    patch.cancelledAt = new Date();
  }
  return patch;
}

export interface IssueFilters {
  status?: string;
  assigneeAgentId?: string;
  projectId?: string;
}

export function issueService(db: Db) {
  return {
    list: async (companyId: string, filters?: IssueFilters) => {
      const conditions = [eq(issues.companyId, companyId)];
      if (filters?.status) conditions.push(eq(issues.status, filters.status));
      if (filters?.assigneeAgentId) {
        conditions.push(eq(issues.assigneeAgentId, filters.assigneeAgentId));
      }
      if (filters?.projectId) conditions.push(eq(issues.projectId, filters.projectId));

      return db.select().from(issues).where(and(...conditions)).orderBy(desc(issues.updatedAt));
    },

    getById: (id: string) =>
      db
        .select()
        .from(issues)
        .where(eq(issues.id, id))
        .then((rows) => rows[0] ?? null),

    create: (companyId: string, data: Omit<typeof issues.$inferInsert, "companyId">) => {
      const values = { ...data, companyId } as typeof issues.$inferInsert;
      if (values.status === "in_progress" && !values.startedAt) {
        values.startedAt = new Date();
      }
      if (values.status === "done") {
        values.completedAt = new Date();
      }
      if (values.status === "cancelled") {
        values.cancelledAt = new Date();
      }

      return db
        .insert(issues)
        .values(values)
        .returning()
        .then((rows) => rows[0]);
    },

    update: async (id: string, data: Partial<typeof issues.$inferInsert>) => {
      const existing = await db
        .select()
        .from(issues)
        .where(eq(issues.id, id))
        .then((rows) => rows[0] ?? null);
      if (!existing) return null;

      if (data.status) {
        assertTransition(existing.status, data.status);
      }

      const patch: Partial<typeof issues.$inferInsert> = {
        ...data,
        updatedAt: new Date(),
      };

      if (patch.status === "in_progress" && !patch.assigneeAgentId && !existing.assigneeAgentId) {
        throw unprocessable("in_progress issues require an assignee");
      }

      applyStatusSideEffects(data.status, patch);

      return db
        .update(issues)
        .set(patch)
        .where(eq(issues.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    remove: (id: string) =>
      db
        .delete(issues)
        .where(eq(issues.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    checkout: async (id: string, agentId: string, expectedStatuses: string[]) => {
      const now = new Date();
      const updated = await db
        .update(issues)
        .set({
          assigneeAgentId: agentId,
          status: "in_progress",
          startedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(issues.id, id),
            inArray(issues.status, expectedStatuses),
            or(isNull(issues.assigneeAgentId), eq(issues.assigneeAgentId, agentId)),
          ),
        )
        .returning()
        .then((rows) => rows[0] ?? null);

      if (updated) return updated;

      const current = await db
        .select({
          id: issues.id,
          status: issues.status,
          assigneeAgentId: issues.assigneeAgentId,
        })
        .from(issues)
        .where(eq(issues.id, id))
        .then((rows) => rows[0] ?? null);

      if (!current) throw notFound("Issue not found");

      throw conflict("Issue checkout conflict", {
        issueId: current.id,
        status: current.status,
        assigneeAgentId: current.assigneeAgentId,
      });
    },

    release: async (id: string, actorAgentId?: string) => {
      const existing = await db
        .select()
        .from(issues)
        .where(eq(issues.id, id))
        .then((rows) => rows[0] ?? null);

      if (!existing) return null;
      if (actorAgentId && existing.assigneeAgentId && existing.assigneeAgentId !== actorAgentId) {
        throw conflict("Only assignee can release issue");
      }

      return db
        .update(issues)
        .set({
          status: "todo",
          assigneeAgentId: null,
          updatedAt: new Date(),
        })
        .where(eq(issues.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    listComments: (issueId: string) =>
      db
        .select()
        .from(issueComments)
        .where(eq(issueComments.issueId, issueId))
        .orderBy(desc(issueComments.createdAt)),

    addComment: async (issueId: string, body: string, actor: { agentId?: string; userId?: string }) => {
      const issue = await db
        .select({ companyId: issues.companyId })
        .from(issues)
        .where(eq(issues.id, issueId))
        .then((rows) => rows[0] ?? null);

      if (!issue) throw notFound("Issue not found");

      return db
        .insert(issueComments)
        .values({
          companyId: issue.companyId,
          issueId,
          authorAgentId: actor.agentId ?? null,
          authorUserId: actor.userId ?? null,
          body,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    staleCount: async (companyId: string, minutes = 60) => {
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "in_progress"),
            sql`${issues.startedAt} < ${cutoff.toISOString()}`,
          ),
        )
        .then((rows) => rows[0]);

      return Number(result?.count ?? 0);
    },
  };
}
