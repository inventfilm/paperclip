import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { IssueComment, Agent } from "@paperclip/shared";
import { Button } from "@/components/ui/button";
import { Identity } from "./Identity";
import { MarkdownBody } from "./MarkdownBody";
import { MarkdownEditor, type MarkdownEditorRef, type MentionOption } from "./MarkdownEditor";
import { formatDateTime } from "../lib/utils";

interface CommentWithRunMeta extends IssueComment {
  runId?: string | null;
  runAgentId?: string | null;
}

interface CommentThreadProps {
  comments: CommentWithRunMeta[];
  onAdd: (body: string, reopen?: boolean) => Promise<void>;
  issueStatus?: string;
  agentMap?: Map<string, Agent>;
  imageUploadHandler?: (file: File) => Promise<string>;
  draftKey?: string;
}

const CLOSED_STATUSES = new Set(["done", "cancelled"]);
const DRAFT_DEBOUNCE_MS = 800;

function loadDraft(draftKey: string): string {
  try {
    return localStorage.getItem(draftKey) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(draftKey: string, value: string) {
  try {
    if (value.trim()) {
      localStorage.setItem(draftKey, value);
    } else {
      localStorage.removeItem(draftKey);
    }
  } catch {
    // Ignore localStorage failures.
  }
}

function clearDraft(draftKey: string) {
  try {
    localStorage.removeItem(draftKey);
  } catch {
    // Ignore localStorage failures.
  }
}

export function CommentThread({ comments, onAdd, issueStatus, agentMap, imageUploadHandler, draftKey }: CommentThreadProps) {
  const [body, setBody] = useState("");
  const [reopen, setReopen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const editorRef = useRef<MarkdownEditorRef>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isClosed = issueStatus ? CLOSED_STATUSES.has(issueStatus) : false;

  // Display oldest-first
  const sorted = useMemo(
    () => [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [comments],
  );

  // Build mention options from agent map (exclude terminated agents)
  const mentions = useMemo<MentionOption[]>(() => {
    if (!agentMap) return [];
    return Array.from(agentMap.values())
      .filter((a) => a.status !== "terminated")
      .map((a) => ({
        id: a.id,
        name: a.name,
      }));
  }, [agentMap]);

  useEffect(() => {
    if (!draftKey) return;
    setBody(loadDraft(draftKey));
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveDraft(draftKey, body);
    }, DRAFT_DEBOUNCE_MS);
  }, [body, draftKey]);

  useEffect(() => {
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, []);

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await onAdd(trimmed, isClosed && reopen ? true : undefined);
      setBody("");
      if (draftKey) clearDraft(draftKey);
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
              {comment.authorAgentId ? (
                <Link to={`/agents/${comment.authorAgentId}`} className="hover:underline">
                  <Identity
                    name={agentMap?.get(comment.authorAgentId)?.name ?? comment.authorAgentId.slice(0, 8)}
                    size="sm"
                  />
                </Link>
              ) : (
                <Identity name="You" size="sm" />
              )}
              <span className="text-xs text-muted-foreground">
                {formatDateTime(comment.createdAt)}
              </span>
            </div>
            <MarkdownBody className="text-sm">{comment.body}</MarkdownBody>
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
          imageUploadHandler={imageUploadHandler}
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
