import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues } from "@paperclipai/db";
import { isCronDue, formatRecurrenceDateSuffix } from "@paperclipai/shared";
import { issueService } from "./issues.js";
import { logActivity } from "./activity-log.js";

export function recurringIssueService(db: Db) {
  const issueSvc = issueService(db);

  return {
    /**
     * Check all enabled recurring issue templates and spawn child issues
     * for any that are currently due.
     */
    async tickRecurringIssues(now: Date): Promise<{ spawned: number }> {
      // Find all enabled recurring templates (not themselves spawned from another recurring)
      const templates = await db
        .select()
        .from(issues)
        .where(
          and(
            eq(issues.recurrenceEnabled, true),
            isNull(issues.recurrenceParentId),
          ),
        );

      let spawned = 0;

      for (const template of templates) {
        if (!template.recurrenceCronExpr) continue;

        const due = isCronDue(
          template.recurrenceCronExpr,
          now,
          template.recurrenceLastSpawnedAt,
        );
        if (!due) continue;

        const dateSuffix = formatRecurrenceDateSuffix(now);
        const childTitle = `${template.title} - ${dateSuffix}`;

        // Check for duplicate: same title spawned today
        const existing = await db
          .select({ id: issues.id })
          .from(issues)
          .where(
            and(
              eq(issues.recurrenceParentId, template.id),
              eq(issues.title, childTitle),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (existing) continue;

        // Spawn child issue
        const child = await issueSvc.create(template.companyId, {
          title: childTitle,
          description: template.description,
          status: template.assigneeAgentId ? "todo" : "backlog",
          priority: template.priority,
          projectId: template.projectId,
          goalId: template.goalId,
          assigneeAgentId: template.assigneeAgentId,
          assigneeUserId: template.assigneeUserId,
          parentId: template.id,
          recurrenceParentId: template.id,
          billingCode: template.billingCode,
          assigneeAdapterOverrides: template.assigneeAdapterOverrides as Record<string, unknown> | undefined,
          requestDepth: 0,
        });

        // Update template's last spawned timestamp
        await db
          .update(issues)
          .set({
            recurrenceLastSpawnedAt: now,
            updatedAt: now,
          })
          .where(eq(issues.id, template.id));

        await logActivity(db, {
          companyId: template.companyId,
          actorType: "system",
          actorId: "recurring-scheduler",
          action: "issue.created",
          entityType: "issue",
          entityId: child.id,
          details: {
            title: child.title,
            identifier: child.identifier,
            source: "recurring",
            templateId: template.id,
            templateIdentifier: template.identifier,
          },
        });

        spawned++;
      }

      return { spawned };
    },
  };
}
