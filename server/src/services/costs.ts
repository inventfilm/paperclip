import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { agents, companies, costEvents } from "@paperclip/db";
import { notFound, unprocessable } from "../errors.js";

export function costService(db: Db) {
  return {
    createEvent: async (companyId: string, data: Omit<typeof costEvents.$inferInsert, "companyId">) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, data.agentId))
        .then((rows) => rows[0] ?? null);

      if (!agent) throw notFound("Agent not found");
      if (agent.companyId !== companyId) {
        throw unprocessable("Agent does not belong to company");
      }

      const event = await db
        .insert(costEvents)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]);

      await db
        .update(agents)
        .set({
          spentMonthlyCents: sql`${agents.spentMonthlyCents} + ${event.costCents}`,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, event.agentId));

      await db
        .update(companies)
        .set({
          spentMonthlyCents: sql`${companies.spentMonthlyCents} + ${event.costCents}`,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      const updatedAgent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, event.agentId))
        .then((rows) => rows[0] ?? null);

      if (
        updatedAgent &&
        updatedAgent.budgetMonthlyCents > 0 &&
        updatedAgent.spentMonthlyCents >= updatedAgent.budgetMonthlyCents &&
        updatedAgent.status !== "paused" &&
        updatedAgent.status !== "terminated"
      ) {
        await db
          .update(agents)
          .set({ status: "paused", updatedAt: new Date() })
          .where(eq(agents.id, updatedAgent.id));
      }

      return event;
    },

    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const utilization =
        company.budgetMonthlyCents > 0
          ? (company.spentMonthlyCents / company.budgetMonthlyCents) * 100
          : 0;

      return {
        companyId,
        monthSpendCents: company.spentMonthlyCents,
        monthBudgetCents: company.budgetMonthlyCents,
        monthUtilizationPercent: Number(utilization.toFixed(2)),
      };
    },

    byAgent: async (companyId: string) =>
      db
        .select({
          agentId: costEvents.agentId,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)`,
        })
        .from(costEvents)
        .where(eq(costEvents.companyId, companyId))
        .groupBy(costEvents.agentId)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)`)),

    byProject: async (companyId: string) =>
      db
        .select({
          projectId: costEvents.projectId,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)`,
        })
        .from(costEvents)
        .where(and(eq(costEvents.companyId, companyId), isNotNull(costEvents.projectId)))
        .groupBy(costEvents.projectId)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)`)),
  };
}
