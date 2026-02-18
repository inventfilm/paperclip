import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, type OrgNode } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "../components/StatusBadge";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { formatCents, relativeTime, cn } from "../lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Bot, Plus, List, GitBranch } from "lucide-react";
import type { Agent } from "@paperclip/shared";

const adapterLabels: Record<string, string> = {
  claude_local: "Claude",
  codex_local: "Codex",
  process: "Process",
  http: "HTTP",
};

const roleLabels: Record<string, string> = {
  ceo: "CEO", cto: "CTO", cmo: "CMO", cfo: "CFO",
  engineer: "Engineer", designer: "Designer", pm: "PM",
  qa: "QA", devops: "DevOps", researcher: "Researcher", general: "General",
};

type FilterTab = "all" | "active" | "paused" | "error";

function matchesFilter(status: string, tab: FilterTab): boolean {
  if (tab === "all") return true;
  if (tab === "active") return status === "active" || status === "running" || status === "idle";
  if (tab === "paused") return status === "paused";
  if (tab === "error") return status === "error" || status === "terminated";
  return true;
}

function filterAgents(agents: Agent[], tab: FilterTab): Agent[] {
  return agents.filter((a) => matchesFilter(a.status, tab));
}

function filterOrgTree(nodes: OrgNode[], tab: FilterTab): OrgNode[] {
  if (tab === "all") return nodes;
  return nodes.reduce<OrgNode[]>((acc, node) => {
    const filteredReports = filterOrgTree(node.reports, tab);
    if (matchesFilter(node.status, tab) || filteredReports.length > 0) {
      acc.push({ ...node, reports: filteredReports });
    }
    return acc;
  }, []);
}

export function Agents() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FilterTab>("all");
  const [view, setView] = useState<"list" | "org">("org");

  const { data: agents, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: orgTree } = useQuery({
    queryKey: queryKeys.org(selectedCompanyId!),
    queryFn: () => agentsApi.org(selectedCompanyId!),
    enabled: !!selectedCompanyId && view === "org",
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Agents" }]);
  }, [setBreadcrumbs]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Bot} message="Select a company to view agents." />;
  }

  const filtered = filterAgents(agents ?? [], tab);
  const filteredOrg = filterOrgTree(orgTree ?? [], tab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Agents</h2>
          <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
            <TabsList>
              <TabsTrigger value="all">All{agents ? ` (${agents.length})` : ""}</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="paused">Paused</TabsTrigger>
              <TabsTrigger value="error">Error</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-md">
            <button
              className={cn(
                "p-1.5 transition-colors",
                view === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
              )}
              onClick={() => setView("list")}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              className={cn(
                "p-1.5 transition-colors",
                view === "org" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
              )}
              onClick={() => setView("org")}
            >
              <GitBranch className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button size="sm" onClick={openNewAgent}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Agent
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {agents && agents.length === 0 && (
        <EmptyState
          icon={Bot}
          message="Create your first agent to get started."
          action="New Agent"
          onAction={openNewAgent}
        />
      )}

      {/* List view */}
      {view === "list" && filtered.length > 0 && (
        <div className="border border-border rounded-md">
          {filtered.map((agent) => {
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
                        agent.status === "running"
                          ? "bg-cyan-400 animate-pulse"
                          : agent.status === "active"
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
                    <span className="text-xs text-muted-foreground font-mono">
                      {adapterLabels[agent.adapterType] ?? agent.adapterType}
                    </span>
                    {agent.lastHeartbeatAt && (
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(agent.lastHeartbeatAt)}
                      </span>
                    )}
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

      {view === "list" && agents && agents.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No agents match the selected filter.
        </p>
      )}

      {/* Org chart view */}
      {view === "org" && filteredOrg.length > 0 && (
        <div className="border border-border rounded-md py-1">
          {filteredOrg.map((node) => (
            <OrgTreeNode key={node.id} node={node} depth={0} navigate={navigate} agentMap={agentMap} />
          ))}
        </div>
      )}

      {view === "org" && orgTree && orgTree.length > 0 && filteredOrg.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No agents match the selected filter.
        </p>
      )}

      {view === "org" && orgTree && orgTree.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No organizational hierarchy defined.
        </p>
      )}
    </div>
  );
}

function OrgTreeNode({
  node,
  depth,
  navigate,
  agentMap,
}: {
  node: OrgNode;
  depth: number;
  navigate: (path: string) => void;
  agentMap: Map<string, Agent>;
}) {
  const agent = agentMap.get(node.id);

  const statusColor =
    node.status === "running"
      ? "bg-cyan-400 animate-pulse"
      : node.status === "active"
        ? "bg-green-400"
        : node.status === "paused"
          ? "bg-yellow-400"
          : node.status === "error"
            ? "bg-red-400"
            : "bg-neutral-400";

  const budgetPct =
    agent && agent.budgetMonthlyCents > 0
      ? Math.round((agent.spentMonthlyCents / agent.budgetMonthlyCents) * 100)
      : 0;

  return (
    <div style={{ paddingLeft: depth * 24 }}>
      <button
        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/30 transition-colors w-full text-left"
        onClick={() => navigate(`/agents/${node.id}`)}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className={`absolute inline-flex h-full w-full rounded-full ${statusColor}`} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{node.name}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {roleLabels[node.role] ?? node.role}
            {agent?.title ? ` - ${agent.title}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {agent && (
            <>
              <span className="text-xs text-muted-foreground font-mono">
                {adapterLabels[agent.adapterType] ?? agent.adapterType}
              </span>
              {agent.lastHeartbeatAt && (
                <span className="text-xs text-muted-foreground">
                  {relativeTime(agent.lastHeartbeatAt)}
                </span>
              )}
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
            </>
          )}
          <StatusBadge status={node.status} />
        </div>
      </button>
      {node.reports && node.reports.length > 0 && (
        <div className="border-l border-border/50 ml-4">
          {node.reports.map((child) => (
            <OrgTreeNode key={child.id} node={child} depth={depth + 1} navigate={navigate} agentMap={agentMap} />
          ))}
        </div>
      )}
    </div>
  );
}
