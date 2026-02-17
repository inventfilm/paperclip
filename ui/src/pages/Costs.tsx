import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { costsApi } from "../api/costs";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { formatCents } from "../lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export function Costs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Costs" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.costs(selectedCompanyId!),
    queryFn: async () => {
      const [summary, byAgent, byProject] = await Promise.all([
        costsApi.summary(selectedCompanyId!),
        costsApi.byAgent(selectedCompanyId!),
        costsApi.byProject(selectedCompanyId!),
      ]);
      return { summary, byAgent, byProject };
    },
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={DollarSign} message="Select a company to view costs." />;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Costs</h2>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Month to Date</p>
                <p className="text-sm text-muted-foreground">
                  {data.summary.monthUtilizationPercent}% utilized
                </p>
              </div>
              <p className="text-2xl font-bold">
                {formatCents(data.summary.monthSpendCents)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  / {formatCents(data.summary.monthBudgetCents)}
                </span>
              </p>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    data.summary.monthUtilizationPercent > 90
                      ? "bg-red-400"
                      : data.summary.monthUtilizationPercent > 70
                        ? "bg-yellow-400"
                        : "bg-green-400"
                  }`}
                  style={{ width: `${Math.min(100, data.summary.monthUtilizationPercent)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">By Agent</h3>
                {data.byAgent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cost events yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.byAgent.map((row, idx) => (
                      <div
                        key={`${row.agentId ?? "na"}-${idx}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-mono text-xs truncate">
                          {row.agentId ?? "Unattributed"}
                        </span>
                        <span className="font-medium">{formatCents(row.costCents)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">By Project</h3>
                {data.byProject.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No project-attributed costs yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.byProject.map((row, idx) => (
                      <div
                        key={`${row.projectId ?? "na"}-${idx}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-mono text-xs truncate">
                          {row.projectId ?? "Unattributed"}
                        </span>
                        <span className="font-medium">{formatCents(row.costCents)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
