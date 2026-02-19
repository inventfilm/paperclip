import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { approvals } from "@paperclip/db";
import type { SidebarBadges } from "@paperclip/shared";

const ACTIONABLE_APPROVAL_STATUSES = ["pending", "revision_requested"];

export function sidebarBadgeService(db: Db) {
  return {
    get: async (companyId: string): Promise<SidebarBadges> => {
      const actionableApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(
          and(
            eq(approvals.companyId, companyId),
            inArray(approvals.status, ACTIONABLE_APPROVAL_STATUSES),
          ),
        )
        .then((rows) => Number(rows[0]?.count ?? 0));

      return {
        // Inbox currently mirrors actionable approvals; expand as inbox categories grow.
        inbox: actionableApprovals,
        approvals: actionableApprovals,
      };
    },
  };
}
