import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Markdown from "react-markdown";
import type { IssueComment, Agent } from "@paperclip/shared";
import { Button } from "@/components/ui/button";
import { Identity } from "./Identity";
import { MarkdownEditor, type MarkdownEditorRef, type MentionOption } from "./MarkdownEditor";
import { formatDate } from "../lib/utils";

interface CommentWithRunMeta extends IssueComment {
  runId?: string | null;
  runAgentId?: string | null;
}

interface CommentThreadProps {
  comments: CommentWithRunMeta[];
  onAdd: (body: string, reopen?: boolean) => Promise<void>;
  issueStatus?: string;
  agentMap?: Map<string, Agent>;
}

const CLOSED_STATUSES = new Set(["done", "cancelled"]);

export function CommentThread({ comments, onAdd, issueStatus, agentMap }: CommentThreadProps) {
  const [body, setBody] = useState("");
  const [reopen, setReopen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const editorRef = useRef<MarkdownEditorRef>(null);

  const isClosed = issueStatus ? CLOSED_STATUSES.has(issueStatus) : false;

  // Display oldest-first
  const sorted = useMemo(
    () => [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [comments],
  );

  // Build mention options from agent map
  const mentions = useMemo<MentionOption[]>(() => {
    if (!agentMap) return [];
    return Array.from(agentMap.values()).map((a) => ({
      id: a.id,
      name: a.name,
    }));
  }, [agentMap]);

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await onAdd(trimmed, isClosed && reopen ? true : undefined);
      setBody("");
      setReopen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Comments ({comments.length})</h3>

      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}

      <div className="space-y-3">
        {sorted.map((comment) => (
          <div key={comment.id} className="border border-border p-3">
            <div className="flex items-center justify-between mb-1">
              <Identity
                name={
                  comment.authorAgentId
                    ? agentMap?.get(comment.authorAgentId)?.name ?? comment.authorAgentId.slice(0, 8)
                    : "You"
                }
                size="sm"
              />
              <span className="text-xs text-muted-foreground">
                {formatDate(comment.createdAt)}
              </span>
            </div>
            <div className="text-sm prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-headings:my-2 prose-headings:text-sm">
              <Markdown>{comment.body}</Markdown>
            </div>
            {comment.runId && comment.runAgentId && (
              <div className="mt-2 pt-2 border-t border-border/60">
                <Link
                  to={`/agents/${comment.runAgentId}/runs/${comment.runId}`}
                  className="inline-flex items-center rounded-md border border-border bg-accent/30 px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  run {comment.runId.slice(0, 8)}
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <MarkdownEditor
          ref={editorRef}
          value={body}
          onChange={setBody}
          placeholder="Leave a comment..."
          mentions={mentions}
          onSubmit={handleSubmit}
          contentClassName="min-h-[60px] text-sm"
        />
        <div className="flex items-center justify-end gap-3">
          {isClosed && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reopen}
                onChange={(e) => setReopen(e.target.checked)}
                className="rounded border-border"
              />
              Re-open
            </label>
          )}
          <Button size="sm" disabled={!body.trim() || submitting} onClick={handleSubmit}>
            {submitting ? "Posting..." : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
