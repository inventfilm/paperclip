import { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { issuesApi } from "../api/issues";
import { useApi } from "../hooks/useApi";
import { usePanel } from "../context/PanelContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { InlineEditor } from "../components/InlineEditor";
import { CommentThread } from "../components/CommentThread";
import { IssueProperties } from "../components/IssueProperties";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import type { IssueComment } from "@paperclip/shared";
import { Separator } from "@/components/ui/separator";

export function IssueDetail() {
  const { issueId } = useParams<{ issueId: string }>();
  const { openPanel, closePanel } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();

  const issueFetcher = useCallback(() => {
    if (!issueId) return Promise.reject(new Error("No issue ID"));
    return issuesApi.get(issueId);
  }, [issueId]);

  const commentsFetcher = useCallback(() => {
    if (!issueId) return Promise.resolve([] as IssueComment[]);
    return issuesApi.listComments(issueId);
  }, [issueId]);

  const { data: issue, loading, error, reload: reloadIssue } = useApi(issueFetcher);
  const { data: comments, reload: reloadComments } = useApi(commentsFetcher);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Issues", href: "/issues" },
      { label: issue?.title ?? issueId ?? "Issue" },
    ]);
  }, [setBreadcrumbs, issue, issueId]);

  async function handleUpdate(data: Record<string, unknown>) {
    if (!issueId) return;
    await issuesApi.update(issueId, data);
    reloadIssue();
  }

  async function handleAddComment(body: string) {
    if (!issueId) return;
    await issuesApi.addComment(issueId, body);
    reloadComments();
  }

  useEffect(() => {
    if (issue) {
      openPanel(
        <IssueProperties issue={issue} onUpdate={handleUpdate} />
      );
    }
    return () => closePanel();
  }, [issue]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!issue) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <StatusIcon
            status={issue.status}
            onChange={(status) => handleUpdate({ status })}
          />
          <PriorityIcon
            priority={issue.priority}
            onChange={(priority) => handleUpdate({ priority })}
          />
          <span className="text-xs font-mono text-muted-foreground">{issue.id.slice(0, 8)}</span>
        </div>

        <InlineEditor
          value={issue.title}
          onSave={(title) => handleUpdate({ title })}
          as="h2"
          className="text-xl font-bold"
        />

        <InlineEditor
          value={issue.description ?? ""}
          onSave={(description) => handleUpdate({ description })}
          as="p"
          className="text-sm text-muted-foreground"
          placeholder="Add a description..."
          multiline
        />
      </div>

      <Separator />

      <CommentThread
        comments={comments ?? []}
        onAdd={handleAddComment}
      />
    </div>
  );
}
