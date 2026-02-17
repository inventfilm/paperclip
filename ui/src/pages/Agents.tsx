import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "../components/StatusBadge";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { formatCents } from "../lib/utils";
import { Bot } from "lucide-react";

export function Agents() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  const { data: agents, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Agents" }]);
  }, [setBreadcrumbs]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Bot} message="Select a company to view agents." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Agents</h2>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {agents && agents.length === 0 && (
        <EmptyState
          icon={Bot}
          message="No agents yet. Agents are created via the API or templates."
        />
      )}

      {agents && agents.length > 0 && (
        <div className="border border-border rounded-md">
          {agents.map((agent) => {
            const budgetPct =
              agent.budgetMonthlyCents > 0
                ? Math.round((agent.spentMonthlyCents / agent.budgetMonthlyCents) * 100)
                : 0;

            return (
              <EntityRow
                key={agent.id}
                title={agent.name}
                subtitle={`${agent.role}${agent.title ? ` - ${agent.title}` : ""}`}
                onClick={() => navigate(`/agents/${agent.id}`)}
                leading={
                  <span className="relative flex h-2.5 w-2.5">
                    <span
                      className={`absolute inline-flex h-full w-full rounded-full ${
                        agent.status === "active"
                          ? "bg-green-400"
                          : agent.status === "paused"
                            ? "bg-yellow-400"
                            : agent.status === "error"
                              ? "bg-red-400"
                              : "bg-neutral-400"
                      }`}
                    />
                  </span>
                }
                trailing={
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            budgetPct > 90
                              ? "bg-red-400"
                              : budgetPct > 70
                                ? "bg-yellow-400"
                                : "bg-green-400"
                          }`}
                          style={{ width: `${Math.min(100, budgetPct)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {formatCents(agent.spentMonthlyCents)} / {formatCents(agent.budgetMonthlyCents)}
                      </span>
                    </div>
                    <StatusBadge status={agent.status} />
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
