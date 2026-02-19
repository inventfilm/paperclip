import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { agents, companies, issues, issueComments } from "@paperclip/db";
import { conflict, notFound, unprocessable } from "../errors.js";

const ALL_ISSUE_STATUSES = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"];

function assertTransition(from: string, to: string) {
  if (from === to) return;
  if (!ALL_ISSUE_STATUSES.includes(to)) {
    throw conflict(`Unknown issue status: ${to}`);
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
  async function assertAssignableAgent(companyId: string, agentId: string) {
    const assignee = await db
      .select({
        id: agents.id,
        companyId: agents.companyId,
        status: agents.status,
      })
      .from(agents)
      .where(eq(agents.id, agentId))
      .then((rows) => rows[0] ?? null);

    if (!assignee) throw notFound("Assignee agent not found");
    if (assignee.companyId !== companyId) {
      throw unprocessable("Assignee must belong to same company");
    }
    if (assignee.status === "pending_approval") {
      throw conflict("Cannot assign work to pending approval agents");
    }
    if (assignee.status === "terminated") {
      throw conflict("Cannot assign work to terminated agents");
    }
  }

  return {
    list: async (companyId: string, filters?: IssueFilters) => {
      const conditions = [eq(issues.companyId, companyId)];
      if (filters?.status) {
        const statuses = filters.status.split(",").map((s) => s.trim());
        conditions.push(statuses.length === 1 ? eq(issues.status, statuses[0]) : inArray(issues.status, statuses));
      }
      if (filters?.assigneeAgentId) {
        conditions.push(eq(issues.assigneeAgentId, filters.assigneeAgentId));
      }
      if (filters?.projectId) conditions.push(eq(issues.projectId, filters.projectId));
      conditions.push(isNull(issues.hiddenAt));

      const priorityOrder = sql`CASE ${issues.priority} WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`;
      return db.select().from(issues).where(and(...conditions)).orderBy(asc(priorityOrder), desc(issues.updatedAt));
    },

    getById: (id: string) =>
      db
        .select()
        .from(issues)
        .where(eq(issues.id, id))
        .then((rows) => rows[0] ?? null),

    getByIdentifier: (identifier: string) =>
      db
        .select()
        .from(issues)
        .where(eq(issues.identifier, identifier.toUpperCase()))
        .then((rows) => rows[0] ?? null),

    create: async (companyId: string, data: Omit<typeof issues.$inferInsert, "companyId">) => {
      if (data.assigneeAgentId) {
        await assertAssignableAgent(companyId, data.assigneeAgentId);
      }
      return db.transaction(async (tx) => {
        const [company] = await tx
          .update(companies)
          .set({ issueCounter: sql`${companies.issueCounter} + 1` })
          .where(eq(companies.id, companyId))
          .returning({ issueCounter: companies.issueCounter, issuePrefix: companies.issuePrefix });

        const issueNumber = company.issueCounter;
        const identifier = `${company.issuePrefix}-${issueNumber}`;

        const values = { ...data, companyId, issueNumber, identifier } as typeof issues.$inferInsert;
        if (values.status === "in_progress" && !values.startedAt) {
          values.startedAt = new Date();
        }
        if (values.status === "done") {
          values.completedAt = new Date();
        }
        if (values.status === "cancelled") {
          values.cancelledAt = new Date();
        }

        const [issue] = await tx.insert(issues).values(values).returning();
        return issue;
      });
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
      if (data.assigneeAgentId) {
        await assertAssignableAgent(existing.companyId, data.assigneeAgentId);
      }

      applyStatusSideEffects(data.status, patch);
      if (data.status && data.status !== "done") {
        patch.completedAt = null;
      }
      if (data.status && data.status !== "cancelled") {
        patch.cancelledAt = null;
      }

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
      const issueCompany = await db
        .select({ companyId: issues.companyId })
        .from(issues)
        .where(eq(issues.id, id))
        .then((rows) => rows[0] ?? null);
      if (!issueCompany) throw notFound("Issue not found");
      await assertAssignableAgent(issueCompany.companyId, agentId);

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

      // If this agent already owns it and it's in_progress, return it (no self-409)
      if (current.assigneeAgentId === agentId && current.status === "in_progress") {
        return db.select().from(issues).where(eq(issues.id, id)).then((rows) => rows[0]!);
      }

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

    findMentionedAgents: async (companyId: string, body: string) => {
      const re = /\B@([^\s@,!?.]+)/g;
      const tokens = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) tokens.add(m[1].toLowerCase());
      if (tokens.size === 0) return [];
      const rows = await db.select({ id: agents.id, name: agents.name })
        .from(agents).where(eq(agents.companyId, companyId));
      return rows.filter(a => tokens.has(a.name.toLowerCase())).map(a => a.id);
    },

    getAncestors: async (issueId: string) => {
      const ancestors: Array<{
        id: string; title: string; description: string | null;
        status: string; priority: string;
        assigneeAgentId: string | null; projectId: string | null; goalId: string | null;
      }> = [];
      const visited = new Set<string>([issueId]);
      const start = await db.select().from(issues).where(eq(issues.id, issueId)).then(r => r[0] ?? null);
      let currentId = start?.parentId ?? null;
      while (currentId && !visited.has(currentId) && ancestors.length < 50) {
        visited.add(currentId);
        const parent = await db.select({
          id: issues.id, title: issues.title, description: issues.description,
          status: issues.status, priority: issues.priority,
          assigneeAgentId: issues.assigneeAgentId, projectId: issues.projectId,
          goalId: issues.goalId, parentId: issues.parentId,
        }).from(issues).where(eq(issues.id, currentId)).then(r => r[0] ?? null);
        if (!parent) break;
        ancestors.push({
          id: parent.id, title: parent.title, description: parent.description ?? null,
          status: parent.status, priority: parent.priority,
          assigneeAgentId: parent.assigneeAgentId ?? null,
          projectId: parent.projectId ?? null, goalId: parent.goalId ?? null,
        });
        currentId = parent.parentId ?? null;
      }
      return ancestors;
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
