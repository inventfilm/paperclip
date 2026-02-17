import { useCallback } from "react";
import { goalsApi } from "../api/goals";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { useCompany } from "../context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";

export function Goals() {
  const { selectedCompanyId } = useCompany();

  const fetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return goalsApi.list(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data: goals, loading, error } = useApi(fetcher);

  if (!selectedCompanyId) {
    return <p className="text-muted-foreground">Select a company first.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Goals</h2>
      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {goals && goals.length === 0 && <p className="text-muted-foreground">No goals yet.</p>}
      {goals && goals.length > 0 && (
        <div className="grid gap-4">
          {goals.map((goal) => (
            <Card key={goal.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{goal.title}</h3>
                    {goal.description && <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>}
                    <p className="text-xs text-muted-foreground mt-2">Level: {goal.level}</p>
                  </div>
                  <StatusBadge status={goal.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
