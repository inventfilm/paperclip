import { useState } from "react";
import type { IssueComment } from "@paperclip/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "../lib/utils";

interface CommentThreadProps {
  comments: IssueComment[];
  onAdd: (body: string) => Promise<void>;
}

export function CommentThread({ comments, onAdd }: CommentThreadProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await onAdd(trimmed);
      setBody("");
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
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                {comment.authorAgentId ? "Agent" : "Human"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(comment.createdAt)}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          placeholder="Leave a comment..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        <Button type="submit" size="sm" disabled={!body.trim() || submitting}>
          {submitting ? "Posting..." : "Comment"}
        </Button>
      </form>
    </div>
  );
}
