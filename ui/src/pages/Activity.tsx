import { useCallback } from "react";
import { activityApi } from "../api/activity";
import { useCompany } from "../context/CompanyContext";
import { useApi } from "../hooks/useApi";
import { formatDate } from "../lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function Activity() {
  const { selectedCompanyId } = useCompany();

  const fetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return activityApi.list(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data, loading, error } = useApi(fetcher);

  if (!selectedCompanyId) {
    return <p className="text-muted-foreground">Select a company first.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Activity</h2>
      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}

      {data && data.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{event.action}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {event.entityType} {event.entityId}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
