import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "../api/approvals";
import { dashboardApi } from "../api/dashboard";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { EmptyState } from "../components/EmptyState";
import { ApprovalCard } from "../components/ApprovalCard";
import { StatusBadge } from "../components/StatusBadge";
import { timeAgo } from "../lib/timeAgo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Inbox as InboxIcon,
  AlertTriangle,
  Clock,
  ExternalLink,
  ArrowUpRight,
  XCircle,
} from "lucide-react";
import { Identity } from "../components/Identity";
import type { HeartbeatRun, Issue } from "@paperclip/shared";

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const FAILED_RUN_STATUSES = new Set(["failed", "timed_out"]);

const RUN_SOURCE_LABELS: Record<string, string> = {
  timer: "Scheduled",
  assignment: "Assignment",
  on_demand: "Manual",
  automation: "Automation",
};

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

function getLatestFailedRunsByAgent(runs: HeartbeatRun[]): HeartbeatRun[] {
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latestByAgent = new Map<string, HeartbeatRun>();

  for (const run of sorted) {
    if (!latestByAgent.has(run.agentId)) {
      latestByAgent.set(run.agentId, run);
    }
  }

  return Array.from(latestByAgent.values()).filter((run) =>
    FAILED_RUN_STATUSES.has(run.status),
  );
}

function firstNonEmptyLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const line = value.split("\n").map((chunk) => chunk.trim()).find(Boolean);
  return line ?? null;
}

function runFailureMessage(run: HeartbeatRun): string {
  return (
    firstNonEmptyLine(run.error) ??
    firstNonEmptyLine(run.stderrExcerpt) ??
    "Run exited with an error."
  );
}

function readIssueIdFromRun(run: HeartbeatRun): string | null {
  const context = run.contextSnapshot;
  if (!context) return null;

  const issueId = context["issueId"];
  if (typeof issueId === "string" && issueId.length > 0) return issueId;

  const taskId = context["taskId"];
  if (typeof taskId === "string" && taskId.length > 0) return taskId;

  return null;
}

export function Inbox() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Inbox" }]);
  }, [setBreadcrumbs]);

  const { data: approvals, isLoading: isApprovalsLoading, error } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: dashboard } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: heartbeatRuns } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const staleIssues = issues ? getStaleIssues(issues) : [];

  const agentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents ?? []) map.set(agent.id, agent.name);
    return map;
  }, [agents]);

  const issueById = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues ?? []) map.set(issue.id, issue);
    return map;
  }, [issues]);

  const failedRuns = useMemo(
    () => getLatestFailedRunsByAgent(heartbeatRuns ?? []),
    [heartbeatRuns],
  );

  const agentName = (id: string | null) => {
    if (!id) return null;
    return agentById.get(id) ?? null;
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: (_approval, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      navigate(`/approvals/${id}?resolved=approved`);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={InboxIcon} message="Select a company to view inbox." />;
  }

  const actionableApprovals = (approvals ?? []).filter(
    (approval) => approval.status === "pending" || approval.status === "revision_requested",
  );
  const hasActionableApprovals = actionableApprovals.length > 0;
  const hasRunFailures = failedRuns.length > 0;
  const showAggregateAgentError =
    !!dashboard && dashboard.agents.error > 0 && !hasRunFailures;
  const hasAlerts =
    !!dashboard &&
    (showAggregateAgentError || (dashboard.costs.monthBudgetCents > 0 && dashboard.costs.monthUtilizationPercent >= 80));
  const hasStale = staleIssues.length > 0;
  const hasContent = hasActionableApprovals || hasRunFailures || hasAlerts || hasStale;

  return (
    <div className="space-y-6">
      {isApprovalsLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {!isApprovalsLoading && !hasContent && (
        <EmptyState icon={InboxIcon} message="You're all caught up!" />
      )}

      {/* Pending Approvals */}
      {hasActionableApprovals && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Approvals
            </h3>
            <button
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => navigate("/approvals")}
            >
              See all approvals <ExternalLink className="ml-0.5 inline h-3 w-3" />
            </button>
          </div>
          <div className="grid gap-3">
            {actionableApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                requesterAgent={approval.requestedByAgentId ? (agents ?? []).find((a) => a.id === approval.requestedByAgentId) ?? null : null}
                onApprove={() => approveMutation.mutate(approval.id)}
                onReject={() => rejectMutation.mutate(approval.id)}
                onOpen={() => navigate(`/approvals/${approval.id}`)}
                isPending={approveMutation.isPending || rejectMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Failed Runs */}
      {hasRunFailures && (
        <>
          {hasActionableApprovals && <Separator />}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Failed Runs
            </h3>
            <div className="grid gap-3">
              {failedRuns.map((run) => {
                const issueId = readIssueIdFromRun(run);
                const issue = issueId ? issueById.get(issueId) ?? null : null;
                const sourceLabel = RUN_SOURCE_LABELS[run.invocationSource] ?? "Manual";
                const displayError = runFailureMessage(run);
                const linkedAgentName = agentName(run.agentId);

                return (
                  <div
                    key={run.id}
                    className="group relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-card to-card p-4"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
                    <div className="relative space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-red-500/20 p-1.5">
                              <XCircle className="h-4 w-4 text-red-400" />
                            </span>
                            {linkedAgentName
                              ? <Identity name={linkedAgentName} size="sm" />
                              : <span className="text-sm font-medium">Agent {run.agentId.slice(0, 8)}</span>}
                            <StatusBadge status={run.status} />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {sourceLabel} run failed {timeAgo(run.createdAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5"
                          onClick={() => navigate(`/agents/${run.agentId}/runs/${run.id}`)}
                        >
                          Open run
                          <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm">
                        {displayError}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-muted-foreground">run {run.id.slice(0, 8)}</span>
                        {issue ? (
                          <button
                            type="button"
                            className="truncate text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => navigate(`/issues/${issue.identifier ?? issue.id}`)}
                          >
                            {issue.identifier ?? issue.id.slice(0, 8)} · {issue.title}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">
                            {run.errorCode ? `code: ${run.errorCode}` : "No linked issue"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Alerts */}
      {hasAlerts && (
        <>
          {(hasActionableApprovals || hasRunFailures) && <Separator />}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Alerts
            </h3>
            <div className="divide-y divide-border border border-border">
              {showAggregateAgentError && (
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                  onClick={() => navigate("/agents")}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <span className="text-sm">
                    <span className="font-medium">{dashboard!.agents.error}</span>{" "}
                    {dashboard!.agents.error === 1 ? "agent has" : "agents have"} errors
                  </span>
                </div>
              )}
              {dashboard!.costs.monthBudgetCents > 0 && dashboard!.costs.monthUtilizationPercent >= 80 && (
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                  onClick={() => navigate("/costs")}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
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
          {(hasActionableApprovals || hasRunFailures || hasAlerts) && <Separator />}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Stale Work
            </h3>
            <div className="divide-y divide-border border border-border">
              {staleIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                  onClick={() => navigate(`/issues/${issue.identifier ?? issue.id}`)}
                >
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <PriorityIcon priority={issue.priority} />
                  <StatusIcon status={issue.status} />
                  <span className="text-xs font-mono text-muted-foreground">
                    {issue.identifier ?? issue.id.slice(0, 8)}
                  </span>
                  <span className="flex-1 truncate text-sm">{issue.title}</span>
                  {issue.assigneeAgentId && (() => {
                    const name = agentName(issue.assigneeAgentId);
                    return name
                      ? <Identity name={name} size="sm" />
                      : <span className="font-mono text-xs text-muted-foreground">{issue.assigneeAgentId.slice(0, 8)}</span>;
                  })()}
                  <span className="shrink-0 text-xs text-muted-foreground">
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
