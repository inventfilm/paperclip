import { useCallback } from "react";
import { costsApi } from "../api/costs";
import { useCompany } from "../context/CompanyContext";
import { useApi } from "../hooks/useApi";
import { formatCents } from "../lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function Costs() {
  const { selectedCompanyId } = useCompany();

  const fetcher = useCallback(async () => {
    if (!selectedCompanyId) {
      return null;
    }

    const [summary, byAgent, byProject] = await Promise.all([
      costsApi.summary(selectedCompanyId),
      costsApi.byAgent(selectedCompanyId),
      costsApi.byProject(selectedCompanyId),
    ]);

    return { summary, byAgent, byProject };
  }, [selectedCompanyId]);

  const { data, loading, error } = useApi(fetcher);

  if (!selectedCompanyId) {
    return <p className="text-muted-foreground">Select a company first.</p>;
  }

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold">Costs</h2>

      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}

      {data && (
        <>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Month to Date</p>
              <p className="text-lg font-semibold mt-1">
                {formatCents(data.summary.monthSpendCents)} / {formatCents(data.summary.monthBudgetCents)}
              </p>
              <p className="text-sm text-muted-foreground">Utilization {data.summary.monthUtilizationPercent}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">By Agent</h3>
              <div className="space-y-2 text-sm">
                {data.byAgent.map((row, idx) => (
                  <div key={`${row.agentId ?? "na"}-${idx}`} className="flex justify-between">
                    <span>{row.agentId}</span>
                    <span>{formatCents(row.costCents)}</span>
                  </div>
                ))}
                {data.byAgent.length === 0 && <p className="text-muted-foreground">No cost events yet.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">By Project</h3>
              <div className="space-y-2 text-sm">
                {data.byProject.map((row, idx) => (
                  <div key={`${row.projectId ?? "na"}-${idx}`} className="flex justify-between">
                    <span>{row.projectId}</span>
                    <span>{formatCents(row.costCents)}</span>
                  </div>
                ))}
                {data.byProject.length === 0 && <p className="text-muted-foreground">No project-attributed costs yet.</p>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
