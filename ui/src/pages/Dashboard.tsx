import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { Identity } from "../components/Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard, Clock } from "lucide-react";
import type { Agent, Issue } from "@paperclip/shared";

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const ACTION_VERBS: Record<string, string> = {
  "issue.created": "created",
  "issue.updated": "updated",
  "issue.checked_out": "checked out",
  "issue.released": "released",
  "issue.comment_added": "commented on",
  "issue.commented": "commented on",
  "issue.deleted": "deleted",
  "agent.created": "created",
  "agent.updated": "updated",
  "agent.paused": "paused",
  "agent.resumed": "resumed",
  "agent.terminated": "terminated",
  "agent.key_created": "created API key for",
  "heartbeat.invoked": "invoked heartbeat for",
  "heartbeat.cancelled": "cancelled heartbeat for",
  "approval.created": "requested approval",
  "approval.approved": "approved",
  "approval.rejected": "rejected",
  "project.created": "created",
  "project.updated": "updated",
  "goal.created": "created",
  "goal.updated": "updated",
  "cost.reported": "reported cost for",
  "cost.recorded": "recorded cost for",
  "company.created": "created company",
  "company.updated": "updated company",
};

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "none");
  return value.replace(/_/g, " ");
}

function formatVerb(action: string, details?: Record<string, unknown> | null): string {
  if (action === "issue.updated" && details) {
    const previous = (details._previous ?? {}) as Record<string, unknown>;
    if (details.status !== undefined) {
      const from = previous.status;
      return from
        ? `changed status from ${humanizeValue(from)} to ${humanizeValue(details.status)} on`
        : `changed status to ${humanizeValue(details.status)} on`;
    }
    if (details.priority !== undefined) {
      const from = previous.priority;
      return from
        ? `changed priority from ${humanizeValue(from)} to ${humanizeValue(details.priority)} on`
        : `changed priority to ${humanizeValue(details.priority)} on`;
    }
  }
  return ACTION_VERBS[action] ?? action.replace(/[._]/g, " ");
}

function entityLink(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "issue": return `/issues/${entityId}`;
    case "agent": return `/agents/${entityId}`;
    case "project": return `/projects/${entityId}`;
    case "goal": return `/goals/${entityId}`;
    default: return null;
  }
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
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const staleIssues = issues ? getStaleIssues(issues) : [];
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;

    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);

    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to Paperclip. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  return (
    <div className="space-y-6">
      {selectedCompany && (
        <p className="text-sm text-muted-foreground">{selectedCompany.name}</p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              icon={Bot}
              value={data.agents.running}
              label="Agents Running"
              onClick={() => navigate("/agents")}
              description={
                <span>
                  <span className="cursor-pointer" onClick={() => navigate("/agents")}>{data.agents.paused} paused</span>
                  {", "}
                  <span className="cursor-pointer" onClick={() => navigate("/agents")}>{data.agents.error} errors</span>
                </span>
              }
            />
            <MetricCard
              icon={CircleDot}
              value={data.tasks.inProgress}
              label="Tasks In Progress"
              onClick={() => navigate("/issues")}
              description={
                <span>
                  <span className="cursor-pointer" onClick={() => navigate("/issues")}>{data.tasks.open} open</span>
                  {", "}
                  <span className="cursor-pointer" onClick={() => navigate("/issues")}>{data.tasks.blocked} blocked</span>
                </span>
              }
            />
            <MetricCard
              icon={DollarSign}
              value={formatCents(data.costs.monthSpendCents)}
              label="Month Spend"
              onClick={() => navigate("/costs")}
              description={
                <span className="cursor-pointer" onClick={() => navigate("/costs")}>
                  {data.costs.monthUtilizationPercent}% of {formatCents(data.costs.monthBudgetCents)} budget
                </span>
              }
            />
            <MetricCard
              icon={ShieldCheck}
              value={data.pendingApprovals}
              label="Pending Approvals"
              onClick={() => navigate("/approvals")}
              description={
                <span className="cursor-pointer" onClick={() => navigate("/issues")}>
                  {data.staleTasks} stale tasks
                </span>
              }
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Recent Activity
                </h3>
                <div className="border border-border divide-y divide-border">
                  {recentActivity.map((event) => {
                    const verb = formatVerb(event.action, event.details);
                    const name = entityNameMap.get(`${event.entityType}:${event.entityId}`);
                    const link = entityLink(event.entityType, event.entityId);
                    const actor = event.actorType === "agent" ? agentMap.get(event.actorId) : null;
                    const isAnimated = animatedActivityIds.has(event.id);
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "px-4 py-2 flex items-center justify-between gap-2 text-sm",
                          link && "cursor-pointer hover:bg-accent/50 transition-colors",
                          isAnimated && "activity-row-enter",
                        )}
                        onClick={link ? () => navigate(link) : undefined}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Identity
                            name={actor?.name ?? (event.actorType === "system" ? "System" : event.actorId || "You")}
                            size="sm"
                          />
                          <span className="text-muted-foreground shrink-0">{verb}</span>
                          {name && <span className="truncate">{name}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {timeAgo(event.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stale Tasks */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Stale Tasks
              </h3>
              {staleIssues.length === 0 ? (
                <div className="border border-border p-4">
                  <p className="text-sm text-muted-foreground">No stale tasks. All work is up to date.</p>
                </div>
              ) : (
                <div className="border border-border divide-y divide-border">
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
                      {issue.assigneeAgentId && (() => {
                        const name = agentName(issue.assigneeAgentId);
                        return name
                          ? <Identity name={name} size="sm" className="shrink-0" />
                          : <span className="text-xs text-muted-foreground font-mono shrink-0">{issue.assigneeAgentId.slice(0, 8)}</span>;
                      })()}
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
