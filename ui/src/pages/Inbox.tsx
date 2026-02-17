import { useCallback, useEffect, useState } from "react";
import { approvalsApi } from "../api/approvals";
import { dashboardApi } from "../api/dashboard";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { timeAgo } from "../lib/timeAgo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Inbox as InboxIcon } from "lucide-react";

export function Inbox() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Inbox" }]);
  }, [setBreadcrumbs]);

  const approvalsFetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return approvalsApi.list(selectedCompanyId, "pending");
  }, [selectedCompanyId]);

  const dashboardFetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve(null);
    return dashboardApi.summary(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data: approvals, loading, error, reload } = useApi(approvalsFetcher);
  const { data: dashboard } = useApi(dashboardFetcher);

  async function approve(id: string) {
    setActionError(null);
    try {
      await approvalsApi.approve(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    }
  }

  async function reject(id: string) {
    setActionError(null);
    try {
      await approvalsApi.reject(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    }
  }

  if (!selectedCompanyId) {
    return <EmptyState icon={InboxIcon} message="Select a company to view inbox." />;
  }

  const hasContent = (approvals && approvals.length > 0) || (dashboard && (dashboard.staleTasks > 0));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Inbox</h2>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {!loading && !hasContent && (
        <EmptyState icon={InboxIcon} message="You're all caught up!" />
      )}

      {approvals && approvals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Pending Approvals ({approvals.length})
          </h3>
          <div className="border border-border rounded-md divide-y divide-border">
            {approvals.map((approval) => (
              <div key={approval.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{approval.type.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {timeAgo(approval.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={approval.status} />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-700 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                    onClick={() => approve(approval.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => reject(approval.id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard && dashboard.staleTasks > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Stale Work
            </h3>
            <div className="border border-border rounded-md p-4">
              <p className="text-sm">
                <span className="font-medium">{dashboard.staleTasks}</span> tasks have gone stale
                and may need attention.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
