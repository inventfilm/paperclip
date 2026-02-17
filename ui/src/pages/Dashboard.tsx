import { useCallback } from "react";
import { dashboardApi } from "../api/dashboard";
import { useCompany } from "../context/CompanyContext";
import { useApi } from "../hooks/useApi";
import { formatCents } from "../lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function Dashboard() {
  const { selectedCompanyId, selectedCompany } = useCompany();

  const fetcher = useCallback(() => {
    if (!selectedCompanyId) {
      return Promise.resolve(null);
    }
    return dashboardApi.summary(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data, loading, error } = useApi(fetcher);

  if (!selectedCompanyId) {
    return <p className="text-muted-foreground">Create or select a company to view the dashboard.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">{selectedCompany?.name}</p>
      </div>

      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}

      {data && (
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Agents</p>
              <p className="mt-2 text-sm">Running: {data.agents.running}</p>
              <p className="text-sm">Paused: {data.agents.paused}</p>
              <p className="text-sm">Error: {data.agents.error}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Tasks</p>
              <p className="mt-2 text-sm">Open: {data.tasks.open}</p>
              <p className="text-sm">In Progress: {data.tasks.inProgress}</p>
              <p className="text-sm">Blocked: {data.tasks.blocked}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Costs</p>
              <p className="mt-2 text-sm">
                {formatCents(data.costs.monthSpendCents)} / {formatCents(data.costs.monthBudgetCents)}
              </p>
              <p className="text-sm">Utilization: {data.costs.monthUtilizationPercent}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Governance</p>
              <p className="mt-2 text-sm">Pending approvals: {data.pendingApprovals}</p>
              <p className="text-sm">Stale tasks: {data.staleTasks}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
