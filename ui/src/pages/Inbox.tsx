import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { approvalsApi } from "../api/approvals";
import { dashboardApi } from "../api/dashboard";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useAgents } from "../hooks/useAgents";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { EmptyState } from "../components/EmptyState";
import { timeAgo } from "../lib/timeAgo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Inbox as InboxIcon,
  Shield,
  AlertTriangle,
  Clock,
  ExternalLink,
} from "lucide-react";
import type { Issue } from "@paperclip/shared";

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function getStaleIssues(issues: Issue[]): Issue[] {
  const now = Date.now();
  return issues
    .filter(
      (i) =>
        ["in_progress", "todo"].includes(i.status) &&
        now - new Date(i.updatedAt).getTime() > STALE_THRESHOLD_MS
    )
    .sort(
      (a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    );
}

export function Inbox() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: agents } = useAgents(selectedCompanyId);

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

  const issuesFetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return issuesApi.list(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data: approvals, loading, error, reload } = useApi(approvalsFetcher);
  const { data: dashboard } = useApi(dashboardFetcher);
  const { data: issues } = useApi(issuesFetcher);

  const staleIssues = issues ? getStaleIssues(issues) : [];

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    const agent = agents.find((a) => a.id === id);
    return agent?.name ?? null;
  };

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

  const hasApprovals = approvals && approvals.length > 0;
  const hasAlerts =
    dashboard &&
    (dashboard.agents.error > 0 ||
      dashboard.costs.monthUtilizationPercent >= 80);
  const hasStale = staleIssues.length > 0;
  const hasContent = hasApprovals || hasAlerts || hasStale;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Inbox</h2>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {!loading && !hasContent && (
        <EmptyState icon={InboxIcon} message="You're all caught up!" />
      )}

      {/* Pending Approvals */}
      {hasApprovals && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Approvals
            </h3>
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => navigate("/approvals")}
            >
              See all approvals <ExternalLink className="inline h-3 w-3 ml-0.5" />
            </button>
          </div>
          <div className="border border-border rounded-md divide-y divide-border">
            {approvals!.map((approval) => (
              <div key={approval.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-yellow-500 shrink-0" />
                  <span className="text-sm font-medium">
                    {approval.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {timeAgo(approval.createdAt)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-700 text-green-500 hover:bg-green-900/20"
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
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground ml-auto"
                    onClick={() => navigate(`/approvals/${approval.id}`)}
                  >
                    View details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {hasAlerts && (
        <>
          {hasApprovals && <Separator />}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Alerts
            </h3>
            <div className="border border-border rounded-md divide-y divide-border">
              {dashboard!.agents.error > 0 && (
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate("/agents")}
                >
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <span className="text-sm">
                    <span className="font-medium">{dashboard!.agents.error}</span>{" "}
                    {dashboard!.agents.error === 1 ? "agent has" : "agents have"} errors
                  </span>
                </div>
              )}
              {dashboard!.costs.monthUtilizationPercent >= 80 && (
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate("/costs")}
                >
                  <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
                  <span className="text-sm">
                    Budget at{" "}
                    <span className="font-medium">
                      {dashboard!.costs.monthUtilizationPercent}%
                    </span>{" "}
                    utilization this month
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Stale Work */}
      {hasStale && (
        <>
          {(hasApprovals || hasAlerts) && <Separator />}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Stale Work
            </h3>
            <div className="border border-border rounded-md divide-y divide-border">
              {staleIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/issues/${issue.id}`)}
                >
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <PriorityIcon priority={issue.priority} />
                  <StatusIcon status={issue.status} />
                  <span className="text-xs font-mono text-muted-foreground">
                    {issue.id.slice(0, 8)}
                  </span>
                  <span className="text-sm truncate flex-1">{issue.title}</span>
                  {issue.assigneeAgentId && (
                    <span className="text-xs text-muted-foreground">
                      {agentName(issue.assigneeAgentId) ?? issue.assigneeAgentId.slice(0, 8)}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    updated {timeAgo(issue.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
