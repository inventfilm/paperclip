import { useState } from "react";
import { useAgents } from "../hooks/useAgents";
import { StatusBadge } from "../components/StatusBadge";
import { formatCents } from "../lib/utils";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Agents() {
  const { selectedCompanyId } = useCompany();
  const { data: agents, loading, error, reload } = useAgents(selectedCompanyId);
  const [actionError, setActionError] = useState<string | null>(null);

  async function invoke(agentId: string) {
    setActionError(null);
    try {
      await agentsApi.invoke(agentId);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to invoke agent");
    }
  }

  async function pause(agentId: string) {
    setActionError(null);
    try {
      await agentsApi.pause(agentId);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to pause agent");
    }
  }

  async function resume(agentId: string) {
    setActionError(null);
    try {
      await agentsApi.resume(agentId);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to resume agent");
    }
  }

  if (!selectedCompanyId) {
    return <p className="text-muted-foreground">Select a company first.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Agents</h2>
      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {actionError && <p className="text-destructive mb-3">{actionError}</p>}
      {agents && agents.length === 0 && <p className="text-muted-foreground">No agents yet.</p>}
      {agents && agents.length > 0 && (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {agent.role}
                      {agent.title ? ` - ${agent.title}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {formatCents(agent.spentMonthlyCents)} / {formatCents(agent.budgetMonthlyCents)}
                    </span>
                    <StatusBadge status={agent.status} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => invoke(agent.id)}>
                    Invoke
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => pause(agent.id)}>
                    Pause
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => resume(agent.id)}>
                    Resume
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
