import { cn } from "../lib/utils";

const statusColors: Record<string, string> = {
  active: "bg-green-900/50 text-green-300",
  running: "bg-cyan-900/50 text-cyan-300",
  paused: "bg-orange-900/50 text-orange-300",
  idle: "bg-yellow-900/50 text-yellow-300",
  archived: "bg-neutral-800 text-neutral-400",
  planned: "bg-neutral-800 text-neutral-400",
  achieved: "bg-green-900/50 text-green-300",
  completed: "bg-green-900/50 text-green-300",
  failed: "bg-red-900/50 text-red-300",
  succeeded: "bg-green-900/50 text-green-300",
  error: "bg-red-900/50 text-red-300",
  backlog: "bg-neutral-800 text-neutral-400",
  todo: "bg-blue-900/50 text-blue-300",
  in_progress: "bg-indigo-900/50 text-indigo-300",
  in_review: "bg-violet-900/50 text-violet-300",
  blocked: "bg-amber-900/50 text-amber-300",
  done: "bg-green-900/50 text-green-300",
  cancelled: "bg-neutral-800 text-neutral-500",
  pending: "bg-yellow-900/50 text-yellow-300",
  approved: "bg-green-900/50 text-green-300",
  rejected: "bg-red-900/50 text-red-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusColors[status] ?? "bg-neutral-800 text-neutral-400"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
