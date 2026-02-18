import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { approvals } from "@paperclip/db";
import { notFound, unprocessable } from "../errors.js";
import { agentService } from "./agents.js";

export function approvalService(db: Db) {
  const agentsSvc = agentService(db);

  return {
    list: (companyId: string, status?: string) => {
      const conditions = [eq(approvals.companyId, companyId)];
      if (status) conditions.push(eq(approvals.status, status));
      return db.select().from(approvals).where(and(...conditions));
    },

    getById: (id: string) =>
      db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .then((rows) => rows[0] ?? null),

    create: (companyId: string, data: Omit<typeof approvals.$inferInsert, "companyId">) =>
      db
        .insert(approvals)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    approve: async (id: string, decidedByUserId: string, decisionNote?: string | null) => {
      const existing = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .then((rows) => rows[0] ?? null);

      if (!existing) throw notFound("Approval not found");
      if (existing.status !== "pending") {
        throw unprocessable("Only pending approvals can be approved");
      }

      const now = new Date();
      const updated = await db
        .update(approvals)
        .set({
          status: "approved",
          decidedByUserId,
          decisionNote: decisionNote ?? null,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(approvals.id, id))
        .returning()
        .then((rows) => rows[0]);

      if (updated.type === "hire_agent") {
        const payload = updated.payload as Record<string, unknown>;
        await agentsSvc.create(updated.companyId, {
          name: String(payload.name ?? "New Agent"),
          role: String(payload.role ?? "general"),
          title: typeof payload.title === "string" ? payload.title : null,
          reportsTo: typeof payload.reportsTo === "string" ? payload.reportsTo : null,
          capabilities: typeof payload.capabilities === "string" ? payload.capabilities : null,
          adapterType: String(payload.adapterType ?? "process"),
          adapterConfig:
            typeof payload.adapterConfig === "object" && payload.adapterConfig !== null
              ? (payload.adapterConfig as Record<string, unknown>)
              : {},
          budgetMonthlyCents:
            typeof payload.budgetMonthlyCents === "number" ? payload.budgetMonthlyCents : 0,
          metadata:
            typeof payload.metadata === "object" && payload.metadata !== null
              ? (payload.metadata as Record<string, unknown>)
              : null,
          status: "idle",
          spentMonthlyCents: 0,
          lastHeartbeatAt: null,
        });
      }

      return updated;
    },

    reject: async (id: string, decidedByUserId: string, decisionNote?: string | null) => {
      const existing = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .then((rows) => rows[0] ?? null);

      if (!existing) throw notFound("Approval not found");
      if (existing.status !== "pending") {
        throw unprocessable("Only pending approvals can be rejected");
      }

      const now = new Date();
      return db
        .update(approvals)
        .set({
          status: "rejected",
          decidedByUserId,
          decisionNote: decisionNote ?? null,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(approvals.id, id))
        .returning()
        .then((rows) => rows[0]);
    },
  };
}
