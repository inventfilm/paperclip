/**
 * Canonical status & priority color definitions.
 *
 * Every component that renders a status indicator (StatusIcon, StatusBadge,
 * agent status dots, etc.) should import from here so colors stay consistent.
 */

// ---------------------------------------------------------------------------
// Issue status colors
// ---------------------------------------------------------------------------

/** StatusIcon circle: text + border classes */
export const issueStatusIcon: Record<string, string> = {
  backlog: "text-muted-foreground border-muted-foreground",
  todo: "text-blue-400 border-blue-400",
  in_progress: "text-yellow-400 border-yellow-400",
  in_review: "text-violet-400 border-violet-400",
  done: "text-green-400 border-green-400",
  cancelled: "text-neutral-500 border-neutral-500",
  blocked: "text-red-400 border-red-400",
};

export const issueStatusIconDefault = "text-muted-foreground border-muted-foreground";

/** Text-only color for issue statuses (dropdowns, labels) */
export const issueStatusText: Record<string, string> = {
  backlog: "text-muted-foreground",
  todo: "text-blue-400",
  in_progress: "text-yellow-400",
  in_review: "text-violet-400",
  done: "text-green-400",
  cancelled: "text-neutral-500",
  blocked: "text-red-400",
};

export const issueStatusTextDefault = "text-muted-foreground";

// ---------------------------------------------------------------------------
// Badge colors — used by StatusBadge for all entity types
// ---------------------------------------------------------------------------

export const statusBadge: Record<string, string> = {
  // Agent statuses
  active: "bg-green-900/50 text-green-300",
  running: "bg-cyan-900/50 text-cyan-300",
  paused: "bg-orange-900/50 text-orange-300",
  idle: "bg-yellow-900/50 text-yellow-300",
  archived: "bg-neutral-800 text-neutral-400",

  // Goal statuses
  planned: "bg-neutral-800 text-neutral-400",
  achieved: "bg-green-900/50 text-green-300",
  completed: "bg-green-900/50 text-green-300",

  // Run statuses
  failed: "bg-red-900/50 text-red-300",
  timed_out: "bg-orange-900/50 text-orange-300",
  succeeded: "bg-green-900/50 text-green-300",
  error: "bg-red-900/50 text-red-300",
  terminated: "bg-red-900/50 text-red-300",
  pending: "bg-yellow-900/50 text-yellow-300",

  // Approval statuses
  pending_approval: "bg-amber-900/50 text-amber-300",
  revision_requested: "bg-amber-900/50 text-amber-300",
  approved: "bg-green-900/50 text-green-300",
  rejected: "bg-red-900/50 text-red-300",

  // Issue statuses — consistent hues with issueStatusIcon above
  backlog: "bg-neutral-800 text-neutral-400",
  todo: "bg-blue-900/50 text-blue-300",
  in_progress: "bg-yellow-900/50 text-yellow-300",
  in_review: "bg-violet-900/50 text-violet-300",
  blocked: "bg-red-900/50 text-red-300",
  done: "bg-green-900/50 text-green-300",
  cancelled: "bg-neutral-800 text-neutral-500",
};

export const statusBadgeDefault = "bg-neutral-800 text-neutral-400";

// ---------------------------------------------------------------------------
// Agent status dot — solid background for small indicator dots
// ---------------------------------------------------------------------------

export const agentStatusDot: Record<string, string> = {
  running: "bg-cyan-400 animate-pulse",
  active: "bg-green-400",
  paused: "bg-yellow-400",
  idle: "bg-yellow-400",
  pending_approval: "bg-amber-400",
  error: "bg-red-400",
  archived: "bg-neutral-400",
};

export const agentStatusDotDefault = "bg-neutral-400";

// ---------------------------------------------------------------------------
// Priority colors
// ---------------------------------------------------------------------------

export const priorityColor: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-blue-400",
};

export const priorityColorDefault = "text-yellow-400";
