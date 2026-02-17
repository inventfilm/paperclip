import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useAgents } from "../hooks/useAgents";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useApi } from "../hooks/useApi";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { timeAgo } from "../lib/timeAgo";
import { formatCents } from "../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard, Clock } from "lucide-react";
import type { Issue } from "@paperclip/shared";

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    "company.created": "Company created",
    "agent.created": "Agent created",
    "agent.updated": "Agent updated",
    "agent.key_created": "API key created",
    "issue.created": "Issue created",
    "issue.updated": "Issue updated",
    "issue.checked_out": "Issue checked out",
    "issue.released": "Issue released",
    "issue.commented": "Comment added",
    "heartbeat.invoked": "Heartbeat invoked",
    "heartbeat.completed": "Heartbeat completed",
    "approval.created": "Approval requested",
    "approval.approved": "Approval granted",
    "approval.rejected": "Approval rejected",
    "project.created": "Project created",
    "goal.created": "Goal created",
    "cost.recorded": "Cost recorded",
  };
  return actionMap[action] ?? action.replace(/[._]/g, " ");
}

function getStaleIssues(issues: Issue[]): Issue[] {
  const now = Date.now();
  return issues
    .filter(
      (i) =>
        ["in_progress", "todo"].includes(i.status) &&
        now - new Date(i.updatedAt).getTime() > STALE_THRESHOLD_MS
    )
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

export function Dashboard() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const { data: agents } = useAgents(selectedCompanyId);

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

  const issuesFetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return issuesApi.list(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data, loading, error } = useApi(dashFetcher);
  const { data: activity } = useApi(activityFetcher);
  const { data: issues } = useApi(issuesFetcher);

  const staleIssues = issues ? getStaleIssues(issues) : [];

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

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

          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Activity */}
            {activity && activity.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Recent Activity
                </h3>
                <div className="border border-border rounded-md divide-y divide-border">
                  {activity.slice(0, 10).map((event) => (
                    <div key={event.id} className="px-4 py-2 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">
                          {formatAction(event.action)}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          {event.entityId.slice(0, 8)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {timeAgo(event.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stale Tasks */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Stale Tasks
              </h3>
              {staleIssues.length === 0 ? (
                <div className="border border-border rounded-md p-4">
                  <p className="text-sm text-muted-foreground">No stale tasks. All work is up to date.</p>
                </div>
              ) : (
                <div className="border border-border rounded-md divide-y divide-border">
                  {staleIssues.slice(0, 10).map((issue) => (
                    <div
                      key={issue.id}
                      className="px-4 py-2 flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => navigate(`/issues/${issue.id}`)}
                    >
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <PriorityIcon priority={issue.priority} />
                      <StatusIcon status={issue.status} />
                      <span className="truncate flex-1">{issue.title}</span>
                      {issue.assigneeAgentId && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {agentName(issue.assigneeAgentId) ?? issue.assigneeAgentId.slice(0, 8)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {timeAgo(issue.updatedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
