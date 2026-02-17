import { useCallback, useEffect } from "react";
import { activityApi } from "../api/activity";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useApi } from "../hooks/useApi";
import { EmptyState } from "../components/EmptyState";
import { timeAgo } from "../lib/timeAgo";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

export function Activity() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Activity" }]);
  }, [setBreadcrumbs]);

  const fetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return activityApi.list(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data, loading, error } = useApi(fetcher);

  if (!selectedCompanyId) {
    return <EmptyState icon={History} message="Select a company to view activity." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Activity</h2>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && data.length === 0 && (
        <EmptyState icon={History} message="No activity yet." />
      )}

      {data && data.length > 0 && (
        <div className="border border-border rounded-md divide-y divide-border">
          {data.map((event) => (
            <div key={event.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="secondary" className="shrink-0">
                  {event.entityType}
                </Badge>
                <span className="text-sm font-medium">{event.action}</span>
                <span className="text-xs text-muted-foreground font-mono truncate">
                  {event.entityId.slice(0, 8)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {timeAgo(event.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
