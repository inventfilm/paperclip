import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { usePanel } from "../context/PanelContext";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { AgentProperties } from "../components/AgentProperties";
import { StatusBadge } from "../components/StatusBadge";
import { EntityRow } from "../components/EntityRow";
import { formatCents, formatDate } from "../lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { Issue, HeartbeatRun } from "@paperclip/shared";

export function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const { selectedCompanyId } = useCompany();
  const { openPanel, closePanel } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: agent, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.detail(agentId!),
    queryFn: () => agentsApi.get(agentId!),
    enabled: !!agentId,
  });

  const { data: heartbeats } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!, agentId),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!, agentId),
    enabled: !!selectedCompanyId && !!agentId,
  });

  const { data: allIssues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const assignedIssues = (allIssues ?? []).filter((i) => i.assigneeAgentId === agentId);

  const agentAction = useMutation({
    mutationFn: async (action: "invoke" | "pause" | "resume") => {
      if (!agentId) return Promise.reject(new Error("No agent ID"));
      if (action === "invoke") {
        await agentsApi.invoke(agentId);
        return;
      }
      if (action === "pause") {
        await agentsApi.pause(agentId);
        return;
      }
      await agentsApi.resume(agentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId!) });
      if (selectedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId) });
      }
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Action failed");
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Agents", href: "/agents" },
      { label: agent?.name ?? agentId ?? "Agent" },
    ]);
  }, [setBreadcrumbs, agent, agentId]);

  useEffect(() => {
    if (agent) {
      openPanel(<AgentProperties agent={agent} />);
    }
    return () => closePanel();
  }, [agent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!agent) return null;

  const budgetPct =
    agent.budgetMonthlyCents > 0
      ? Math.round((agent.spentMonthlyCents / agent.budgetMonthlyCents) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{agent.name}</h2>
          <p className="text-sm text-muted-foreground">
            {agent.role}{agent.title ? ` - ${agent.title}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => agentAction.mutate("invoke")}>
            Invoke
          </Button>
          {agent.status === "active" ? (
            <Button variant="outline" size="sm" onClick={() => agentAction.mutate("pause")}>
              Pause
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => agentAction.mutate("resume")}>
              Resume
            </Button>
          )}
          <StatusBadge status={agent.status} />
        </div>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="heartbeats">Heartbeats</TabsTrigger>
          <TabsTrigger value="issues">Issues ({assignedIssues.length})</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Adapter</span>
              <p className="font-mono">{agent.adapterType}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Context Mode</span>
              <p>{agent.contextMode}</p>
            </div>
            {agent.reportsTo && (
              <div>
                <span className="text-muted-foreground">Reports To</span>
                <p className="font-mono">{agent.reportsTo}</p>
              </div>
            )}
            {agent.capabilities && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Capabilities</span>
                <p>{agent.capabilities}</p>
              </div>
            )}
            {agent.lastHeartbeatAt && (
              <div>
                <span className="text-muted-foreground">Last Heartbeat</span>
                <p>{formatDate(agent.lastHeartbeatAt)}</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="heartbeats" className="mt-4">
          {(!heartbeats || heartbeats.length === 0) ? (
            <p className="text-sm text-muted-foreground">No heartbeat runs.</p>
          ) : (
            <div className="border border-border rounded-md">
              {heartbeats.map((run) => (
                <EntityRow
                  key={run.id}
                  identifier={run.id.slice(0, 8)}
                  title={run.invocationSource}
                  subtitle={run.error ?? undefined}
                  trailing={
                    <div className="flex items-center gap-2">
                      <StatusBadge status={run.status} />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </span>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          {assignedIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assigned issues.</p>
          ) : (
            <div className="border border-border rounded-md">
              {assignedIssues.map((issue) => (
                <EntityRow
                  key={issue.id}
                  identifier={issue.id.slice(0, 8)}
                  title={issue.title}
                  trailing={<StatusBadge status={issue.status} />}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="costs" className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Monthly Budget</span>
              <span>
                {formatCents(agent.spentMonthlyCents)} / {formatCents(agent.budgetMonthlyCents)}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPct > 90
                    ? "bg-red-400"
                    : budgetPct > 70
                      ? "bg-yellow-400"
                      : "bg-green-400"
                }`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{budgetPct}% utilized</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
