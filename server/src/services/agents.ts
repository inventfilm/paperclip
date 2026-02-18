import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { agents, agentApiKeys, heartbeatRuns } from "@paperclip/db";
import { conflict, notFound, unprocessable } from "../errors.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return `pcp_${randomBytes(24).toString("hex")}`;
}

export function agentService(db: Db) {
  async function getById(id: string) {
    return db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function ensureManager(companyId: string, managerId: string) {
    const manager = await getById(managerId);
    if (!manager) throw notFound("Manager not found");
    if (manager.companyId !== companyId) {
      throw unprocessable("Manager must belong to same company");
    }
    return manager;
  }

  async function assertNoCycle(agentId: string, reportsTo: string | null | undefined) {
    if (!reportsTo) return;
    if (reportsTo === agentId) throw unprocessable("Agent cannot report to itself");

    let cursor: string | null = reportsTo;
    while (cursor) {
      if (cursor === agentId) throw unprocessable("Reporting relationship would create cycle");
      const next = await getById(cursor);
      cursor = next?.reportsTo ?? null;
    }
  }

  return {
    list: (companyId: string) =>
      db.select().from(agents).where(eq(agents.companyId, companyId)),

    getById,

    create: async (companyId: string, data: Omit<typeof agents.$inferInsert, "companyId">) => {
      if (data.reportsTo) {
        await ensureManager(companyId, data.reportsTo);
      }

      const created = await db
        .insert(agents)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]);

      return created;
    },

    update: async (id: string, data: Partial<typeof agents.$inferInsert>) => {
      const existing = await getById(id);
      if (!existing) return null;

      if (existing.status === "terminated" && data.status && data.status !== "terminated") {
        throw conflict("Terminated agents cannot be resumed");
      }

      if (data.reportsTo !== undefined) {
        if (data.reportsTo) {
          await ensureManager(existing.companyId, data.reportsTo);
        }
        await assertNoCycle(id, data.reportsTo);
      }

      return db
        .update(agents)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(agents.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    pause: async (id: string) => {
      const existing = await getById(id);
      if (!existing) return null;
      if (existing.status === "terminated") throw conflict("Cannot pause terminated agent");

      return db
        .update(agents)
        .set({ status: "paused", updatedAt: new Date() })
        .where(eq(agents.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    resume: async (id: string) => {
      const existing = await getById(id);
      if (!existing) return null;
      if (existing.status === "terminated") throw conflict("Cannot resume terminated agent");

      return db
        .update(agents)
        .set({ status: "idle", updatedAt: new Date() })
        .where(eq(agents.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    terminate: async (id: string) => {
      const existing = await getById(id);
      if (!existing) return null;

      await db
        .update(agents)
        .set({ status: "terminated", updatedAt: new Date() })
        .where(eq(agents.id, id));

      await db
        .update(agentApiKeys)
        .set({ revokedAt: new Date() })
        .where(eq(agentApiKeys.agentId, id));

      return getById(id);
    },

    createApiKey: async (id: string, name: string) => {
      const existing = await getById(id);
      if (!existing) throw notFound("Agent not found");

      const token = createToken();
      const keyHash = hashToken(token);
      const created = await db
        .insert(agentApiKeys)
        .values({
          agentId: id,
          companyId: existing.companyId,
          name,
          keyHash,
        })
        .returning()
        .then((rows) => rows[0]);

      return {
        id: created.id,
        name: created.name,
        token,
        createdAt: created.createdAt,
      };
    },

    listKeys: (id: string) =>
      db
        .select({
          id: agentApiKeys.id,
          name: agentApiKeys.name,
          createdAt: agentApiKeys.createdAt,
          revokedAt: agentApiKeys.revokedAt,
        })
        .from(agentApiKeys)
        .where(eq(agentApiKeys.agentId, id)),

    revokeKey: async (keyId: string) => {
      const rows = await db
        .update(agentApiKeys)
        .set({ revokedAt: new Date() })
        .where(eq(agentApiKeys.id, keyId))
        .returning();
      return rows[0] ?? null;
    },

    orgForCompany: async (companyId: string) => {
      const rows = await db.select().from(agents).where(eq(agents.companyId, companyId));
      const byManager = new Map<string | null, typeof rows>();
      for (const row of rows) {
        const key = row.reportsTo ?? null;
        const group = byManager.get(key) ?? [];
        group.push(row);
        byManager.set(key, group);
      }

      const build = (managerId: string | null): Array<Record<string, unknown>> => {
        const members = byManager.get(managerId) ?? [];
        return members.map((member) => ({
          ...member,
          reports: build(member.id),
        }));
      };

      return build(null);
    },

    getChainOfCommand: async (agentId: string) => {
      const chain: { id: string; name: string; role: string; title: string | null }[] = [];
      const visited = new Set<string>([agentId]);
      const start = await getById(agentId);
      let currentId = start?.reportsTo ?? null;
      while (currentId && !visited.has(currentId) && chain.length < 50) {
        visited.add(currentId);
        const mgr = await getById(currentId);
        if (!mgr) break;
        chain.push({ id: mgr.id, name: mgr.name, role: mgr.role, title: mgr.title ?? null });
        currentId = mgr.reportsTo ?? null;
      }
      return chain;
    },

    runningForAgent: (agentId: string) =>
      db
        .select()
        .from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.agentId, agentId), inArray(heartbeatRuns.status, ["queued", "running"]))),
  };
}
