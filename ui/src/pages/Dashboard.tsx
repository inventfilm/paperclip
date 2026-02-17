import { useCallback, useEffect } from "react";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useApi } from "../hooks/useApi";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { timeAgo } from "../lib/timeAgo";
import { formatCents } from "../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard } from "lucide-react";

export function Dashboard() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const dashFetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve(null);
    return dashboardApi.summary(selectedCompanyId);
  }, [selectedCompanyId]);

  const activityFetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return activityApi.list(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data, loading, error } = useApi(dashFetcher);
  const { data: activity } = useApi(activityFetcher);

  if (!selectedCompanyId) {
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Dashboard</h2>
        {selectedCompany && (
          <p className="text-sm text-muted-foreground">{selectedCompany.name}</p>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              icon={Bot}
              value={data.agents.running}
              label="Agents Running"
              description={`${data.agents.paused} paused, ${data.agents.error} errors`}
            />
            <MetricCard
              icon={CircleDot}
              value={data.tasks.inProgress}
              label="Tasks In Progress"
              description={`${data.tasks.open} open, ${data.tasks.blocked} blocked`}
            />
            <MetricCard
              icon={DollarSign}
              value={formatCents(data.costs.monthSpendCents)}
              label="Month Spend"
              description={`${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)} budget`}
            />
            <MetricCard
              icon={ShieldCheck}
              value={data.pendingApprovals}
              label="Pending Approvals"
              description={`${data.staleTasks} stale tasks`}
            />
          </div>

          {activity && activity.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Recent Activity
              </h3>
              <div className="border border-border rounded-md divide-y divide-border">
                {activity.slice(0, 10).map((event) => (
                  <div key={event.id} className="px-4 py-2 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{event.action}</span>
                      <span className="text-muted-foreground">
                        {event.entityType}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(event.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
