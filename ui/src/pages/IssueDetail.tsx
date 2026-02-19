import { useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { usePanel } from "../context/PanelContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { relativeTime } from "../lib/utils";
import { InlineEditor } from "../components/InlineEditor";
import { CommentThread } from "../components/CommentThread";
import { IssueProperties } from "../components/IssueProperties";
import { LiveRunWidget } from "../components/LiveRunWidget";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { StatusBadge } from "../components/StatusBadge";
import { Identity } from "../components/Identity";
import { Separator } from "@/components/ui/separator";
import { ChevronRight } from "lucide-react";
import type { ActivityEvent } from "@paperclip/shared";
import type { Agent } from "@paperclip/shared";

const ACTION_LABELS: Record<string, string> = {
  "issue.created": "created the issue",
  "issue.updated": "updated the issue",
  "issue.checked_out": "checked out the issue",
  "issue.released": "released the issue",
  "issue.comment_added": "added a comment",
  "issue.deleted": "deleted the issue",
  "agent.created": "created an agent",
  "agent.updated": "updated the agent",
  "agent.paused": "paused the agent",
  "agent.resumed": "resumed the agent",
  "agent.terminated": "terminated the agent",
  "heartbeat.invoked": "invoked a heartbeat",
  "heartbeat.cancelled": "cancelled a heartbeat",
  "approval.created": "requested approval",
  "approval.approved": "approved",
  "approval.rejected": "rejected",
};

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "none");
  return value.replace(/_/g, " ");
}

function formatAction(action: string, details?: Record<string, unknown> | null): string {
  if (action === "issue.updated" && details) {
    const previous = (details._previous ?? {}) as Record<string, unknown>;
    const parts: string[] = [];

    if (details.status !== undefined) {
      const from = previous.status;
      parts.push(
        from
          ? `changed the status from ${humanizeValue(from)} to ${humanizeValue(details.status)}`
          : `changed the status to ${humanizeValue(details.status)}`
      );
    }
    if (details.priority !== undefined) {
      const from = previous.priority;
      parts.push(
        from
          ? `changed the priority from ${humanizeValue(from)} to ${humanizeValue(details.priority)}`
          : `changed the priority to ${humanizeValue(details.priority)}`
      );
    }
    if (details.assigneeAgentId !== undefined) {
      parts.push(details.assigneeAgentId ? "assigned the issue" : "unassigned the issue");
    }
    if (details.title !== undefined) parts.push("updated the title");
    if (details.description !== undefined) parts.push("updated the description");

    if (parts.length > 0) return parts.join(", ");
  }
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

function ActorIdentity({ evt, agentMap }: { evt: ActivityEvent; agentMap: Map<string, Agent> }) {
  const id = evt.actorId;
  if (evt.actorType === "agent") {
    const agent = agentMap.get(id);
    return <Identity name={agent?.name ?? id.slice(0, 8)} size="sm" />;
  }
  if (evt.actorType === "system") return <Identity name="System" size="sm" />;
  return <Identity name={id || "You"} size="sm" />;
}

export function IssueDetail() {
  const { issueId } = useParams<{ issueId: string }>();
  const { selectedCompanyId } = useCompany();
  const { openPanel, closePanel } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const { data: issue, isLoading, error } = useQuery({
    queryKey: queryKeys.issues.detail(issueId!),
    queryFn: () => issuesApi.get(issueId!),
    enabled: !!issueId,
  });

  const { data: comments } = useQuery({
    queryKey: queryKeys.issues.comments(issueId!),
    queryFn: () => issuesApi.listComments(issueId!),
    enabled: !!issueId,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.issues.activity(issueId!),
    queryFn: () => activityApi.forIssue(issueId!),
    enabled: !!issueId,
  });

  const { data: linkedRuns } = useQuery({
    queryKey: queryKeys.issues.runs(issueId!),
    queryFn: () => activityApi.runsForIssue(issueId!),
    enabled: !!issueId,
    refetchInterval: 5000,
  });

  const { data: linkedApprovals } = useQuery({
    queryKey: queryKeys.issues.approvals(issueId!),
    queryFn: () => issuesApi.listApprovals(issueId!),
    enabled: !!issueId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const commentsWithRunMeta = useMemo(() => {
    const runMetaByCommentId = new Map<string, { runId: string; runAgentId: string | null }>();
    const agentIdByRunId = new Map<string, string>();
    for (const run of linkedRuns ?? []) {
      agentIdByRunId.set(run.runId, run.agentId);
    }
    for (const evt of activity ?? []) {
      if (evt.action !== "issue.comment_added" || !evt.runId) continue;
      const details = evt.details ?? {};
      const commentId = typeof details["commentId"] === "string" ? details["commentId"] : null;
      if (!commentId || runMetaByCommentId.has(commentId)) continue;
      runMetaByCommentId.set(commentId, {
        runId: evt.runId,
        runAgentId: evt.agentId ?? agentIdByRunId.get(evt.runId) ?? null,
      });
    }
    return (comments ?? []).map((comment) => {
      const meta = runMetaByCommentId.get(comment.id);
      return meta ? { ...comment, ...meta } : comment;
    });
  }, [activity, comments, linkedRuns]);

  const invalidateIssue = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issueId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.activity(issueId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.runs(issueId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.approvals(issueId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.liveRuns(issueId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.activeRun(issueId!) });
    if (selectedCompanyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId) });
    }
  };

  const updateIssue = useMutation({
    mutationFn: (data: Record<string, unknown>) => issuesApi.update(issueId!, data),
    onSuccess: invalidateIssue,
  });

  const addComment = useMutation({
    mutationFn: ({ body, reopen }: { body: string; reopen?: boolean }) =>
      issuesApi.addComment(issueId!, body, reopen),
    onSuccess: () => {
      invalidateIssue();
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(issueId!) });
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Issues", href: "/issues" },
      { label: issue?.title ?? issueId ?? "Issue" },
    ]);
  }, [setBreadcrumbs, issue, issueId]);

  useEffect(() => {
    if (issue) {
      openPanel(
        <IssueProperties issue={issue} onUpdate={(data) => updateIssue.mutate(data)} />
      );
    }
    return () => closePanel();
  }, [issue]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!issue) return null;

  // Ancestors are returned oldest-first from the server (root at end, immediate parent at start)
  const ancestors = issue.ancestors ?? [];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Parent chain breadcrumb */}
      {ancestors.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          {[...ancestors].reverse().map((ancestor, i) => (
            <span key={ancestor.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
              <Link
                to={`/issues/${ancestor.id}`}
                className="hover:text-foreground transition-colors truncate max-w-[200px]"
                title={ancestor.title}
              >
                {ancestor.title}
              </Link>
            </span>
          ))}
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="text-foreground/60 truncate max-w-[200px]">{issue.title}</span>
        </nav>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <StatusIcon
            status={issue.status}
            onChange={(status) => updateIssue.mutate({ status })}
          />
          <PriorityIcon
            priority={issue.priority}
            onChange={(priority) => updateIssue.mutate({ priority })}
          />
          <span className="text-xs font-mono text-muted-foreground">{issue.identifier ?? issue.id.slice(0, 8)}</span>
        </div>

        <InlineEditor
          value={issue.title}
          onSave={(title) => updateIssue.mutate({ title })}
          as="h2"
          className="text-xl font-bold"
        />

        <InlineEditor
          value={issue.description ?? ""}
          onSave={(description) => updateIssue.mutate({ description })}
          as="p"
          className="text-sm text-muted-foreground"
          placeholder="Add a description..."
          multiline
        />
      </div>

      <LiveRunWidget issueId={issueId!} companyId={selectedCompanyId} />

      <Separator />

      <CommentThread
        comments={commentsWithRunMeta}
        issueStatus={issue.status}
        agentMap={agentMap}
        onAdd={async (body, reopen) => {
          await addComment.mutateAsync({ body, reopen });
        }}
      />

      {linkedApprovals && linkedApprovals.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Linked Approvals</h3>
            <div className="border border-border rounded-lg divide-y divide-border">
              {linkedApprovals.map((approval) => (
                <Link
                  key={approval.id}
                  to={`/approvals/${approval.id}`}
                  className="flex items-center justify-between px-3 py-2 text-xs hover:bg-accent/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={approval.status} />
                    <span className="font-medium">
                      {approval.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                    <span className="font-mono text-muted-foreground">{approval.id.slice(0, 8)}</span>
                  </div>
                  <span className="text-muted-foreground">{relativeTime(approval.createdAt)}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Linked Runs */}
      {linkedRuns && linkedRuns.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Linked Runs</h3>
            <div className="border border-border rounded-lg divide-y divide-border">
              {linkedRuns.map((run) => (
                <Link
                  key={run.runId}
                  to={`/agents/${run.agentId}/runs/${run.runId}`}
                  className="flex items-center justify-between px-3 py-2 text-xs hover:bg-accent/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Identity name={agentMap.get(run.agentId)?.name ?? run.agentId.slice(0, 8)} size="sm" />
                    <StatusBadge status={run.status} />
                    <span className="font-mono text-muted-foreground">{run.runId.slice(0, 8)}</span>
                  </div>
                  <span className="text-muted-foreground">{relativeTime(run.createdAt)}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Activity Log */}
      {activity && activity.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
            <div className="space-y-1.5">
              {activity.slice(0, 20).map((evt) => (
                <div key={evt.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ActorIdentity evt={evt} agentMap={agentMap} />
                  <span>{formatAction(evt.action, evt.details)}</span>
                  <span className="ml-auto shrink-0">{relativeTime(evt.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
