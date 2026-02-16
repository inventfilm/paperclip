import { cn } from "../lib/utils";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  idle: "bg-yellow-100 text-yellow-800",
  offline: "bg-gray-100 text-gray-600",
  error: "bg-red-100 text-red-800",
  backlog: "bg-gray-100 text-gray-600",
  todo: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  in_review: "bg-purple-100 text-purple-800",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusColors[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
