import { useCallback } from "react";
import { issuesApi } from "../api/issues";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { cn } from "../lib/utils";

const priorityColors: Record<string, string> = {
  critical: "text-red-700 bg-red-50",
  high: "text-orange-700 bg-orange-50",
  medium: "text-yellow-700 bg-yellow-50",
  low: "text-gray-600 bg-gray-50",
};

export function Issues() {
  const fetcher = useCallback(() => issuesApi.list(), []);
  const { data: issues, loading, error } = useApi(fetcher);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Issues</h2>
      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">{error.message}</p>}
      {issues && issues.length === 0 && <p className="text-gray-500">No issues yet.</p>}
      {issues && issues.length > 0 && (
        <div className="grid gap-4">
          {issues.map((issue) => (
            <div key={issue.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{issue.title}</h3>
                  {issue.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                      {issue.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      priorityColors[issue.priority] ?? "text-gray-600 bg-gray-50"
                    )}
                  >
                    {issue.priority}
                  </span>
                  <StatusBadge status={issue.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
