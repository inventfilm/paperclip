import { useCallback } from "react";
import { issuesApi } from "../api/issues";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { cn } from "../lib/utils";
import { useCompany } from "../context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";

const priorityColors: Record<string, string> = {
  critical: "text-red-300 bg-red-900/50",
  high: "text-orange-300 bg-orange-900/50",
  medium: "text-yellow-300 bg-yellow-900/50",
  low: "text-neutral-400 bg-neutral-800",
};

export function Issues() {
  const { selectedCompanyId } = useCompany();

  const fetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return issuesApi.list(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data: issues, loading, error } = useApi(fetcher);

  if (!selectedCompanyId) {
    return <p className="text-muted-foreground">Select a company first.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Tasks</h2>
      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {issues && issues.length === 0 && <p className="text-muted-foreground">No tasks yet.</p>}
      {issues && issues.length > 0 && (
        <div className="grid gap-4">
          {issues.map((issue) => (
            <Card key={issue.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{issue.title}</h3>
                    {issue.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{issue.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        priorityColors[issue.priority] ?? "text-neutral-400 bg-neutral-800",
                      )}
                    >
                      {issue.priority}
                    </span>
                    <StatusBadge status={issue.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
