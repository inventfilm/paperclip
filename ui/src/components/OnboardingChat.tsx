import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { IssueComment } from "@paperclipai/shared";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { MarkdownBody } from "./MarkdownBody";
import { cn } from "../lib/utils";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

interface OnboardingChatProps {
  taskId: string;
  agentName: string;
  onPlanDetected?: (planMarkdown: string) => void;
}

/**
 * Detects whether a comment body contains a structured hiring plan.
 * Looks for markdown headers or bullet lists that mention roles/positions.
 */
function detectHiringPlan(body: string): boolean {
  const planPatterns = [
    /##?\s*(hiring|team|org|roles|plan)/i,
    /##?\s*(proposed|recommended)\s*(roles|hires|team)/i,
    /\n-\s+\*\*[^*]+\*\*/g, // bullet list with bold items (role names)
    /\|\s*role\s*\|/i, // markdown table with "Role" header
  ];
  return planPatterns.some((pattern) => pattern.test(body));
}

export function OnboardingChat({
  taskId,
  agentName,
  onPlanDetected,
}: OnboardingChatProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [detectedPlanCommentId, setDetectedPlanCommentId] = useState<
    string | null
  >(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    data: comments,
    isLoading,
  } = useQuery({
    queryKey: queryKeys.issues.comments(taskId),
    queryFn: () => issuesApi.listComments(taskId),
    refetchInterval: 4000,
  });

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments?.length]);

  // Detect hiring plan in agent comments
  useEffect(() => {
    if (!comments || !onPlanDetected || detectedPlanCommentId) return;
    // Scan from newest to oldest for a plan-like comment from the agent
    for (let i = comments.length - 1; i >= 0; i--) {
      const c = comments[i];
      if (c.authorAgentId && detectHiringPlan(c.body)) {
        setDetectedPlanCommentId(c.id);
        onPlanDetected(c.body);
        break;
      }
    }
  }, [comments, onPlanDetected, detectedPlanCommentId]);

  const handleSend = useCallback(async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await issuesApi.addComment(taskId, body);
      setInput("");
      queryClient.invalidateQueries({
        queryKey: queryKeys.issues.comments(taskId),
      });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, taskId, queryClient]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const lastComment = comments?.[comments.length - 1];
  const isWaitingForAgent =
    lastComment && lastComment.authorUserId && !lastComment.authorAgentId;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[180px] max-h-[320px] pr-1"
      >
        {(!comments || comments.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Starting conversation with {agentName}...
          </p>
        )}
        {comments?.map((comment) => {
          const isAgent = Boolean(comment.authorAgentId);
          const isPlan =
            detectedPlanCommentId === comment.id;
          return (
            <div
              key={comment.id}
              className={cn(
                "rounded-md px-3 py-2 text-sm",
                isAgent
                  ? "bg-muted/50 border border-border mr-8"
                  : "bg-accent/50 border border-accent ml-8",
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wide",
                    isAgent
                      ? "text-muted-foreground"
                      : "text-foreground/70",
                  )}
                >
                  {isAgent ? agentName : "You"}
                </span>
                {isPlan && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    Hiring plan detected
                  </span>
                )}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <MarkdownBody>{comment.body}</MarkdownBody>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {isWaitingForAgent && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {agentName} is thinking...
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 border-t border-border pt-3">
        <textarea
          ref={inputRef}
          className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none min-h-[40px] max-h-[100px]"
          placeholder="Message your CEO..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          autoFocus
        />
        <Button
          size="sm"
          disabled={!input.trim() || sending}
          onClick={handleSend}
          className="shrink-0"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Manual plan selection */}
      {!detectedPlanCommentId &&
        comments &&
        comments.some((c) => c.authorAgentId) && (
          <p className="text-[10px] text-muted-foreground mt-2">
            If the CEO has proposed a plan, click "Next" once you're satisfied,
            or keep chatting to refine it.
          </p>
        )}
    </div>
  );
}
