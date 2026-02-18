import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi, type AgentKey } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { usePanel } from "../context/PanelContext";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { AgentProperties } from "../components/AgentProperties";
import { AgentConfigForm } from "../components/AgentConfigForm";
import { adapterLabels, roleLabels } from "../components/agent-config-primitives";
import { StatusBadge } from "../components/StatusBadge";
import { EntityRow } from "../components/EntityRow";
import { formatCents, formatDate, relativeTime, formatTokens } from "../lib/utils";
import { cn } from "../lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MoreHorizontal,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  Loader2,
  Slash,
  RotateCcw,
  Trash2,
  Plus,
  Key,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Agent, HeartbeatRun, HeartbeatRunEvent, AgentRuntimeState } from "@paperclip/shared";

const runStatusIcons: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  succeeded: { icon: CheckCircle2, color: "text-green-400" },
  failed: { icon: XCircle, color: "text-red-400" },
  running: { icon: Loader2, color: "text-cyan-400" },
  queued: { icon: Clock, color: "text-yellow-400" },
  timed_out: { icon: Timer, color: "text-orange-400" },
  cancelled: { icon: Slash, color: "text-neutral-400" },
};

const sourceLabels: Record<string, string> = {
  timer: "Timer",
  assignment: "Assignment",
  on_demand: "On-demand",
  automation: "Automation",
};

export function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const { selectedCompanyId } = useCompany();
  const { openPanel, closePanel } = usePanel();
  const { openNewIssue } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: agent, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.detail(agentId!),
    queryFn: () => agentsApi.get(agentId!),
    enabled: !!agentId,
  });

  const { data: runtimeState } = useQuery({
    queryKey: queryKeys.agents.runtimeState(agentId!),
    queryFn: () => agentsApi.runtimeState(agentId!),
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

  const { data: allAgents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const assignedIssues = (allIssues ?? []).filter((i) => i.assigneeAgentId === agentId);
  const reportsToAgent = (allAgents ?? []).find((a) => a.id === agent?.reportsTo);
  const directReports = (allAgents ?? []).filter((a) => a.reportsTo === agentId);

  const agentAction = useMutation({
    mutationFn: async (action: "invoke" | "pause" | "resume" | "terminate" | "resetSession") => {
      if (!agentId) return Promise.reject(new Error("No agent ID"));
      switch (action) {
        case "invoke": return agentsApi.invoke(agentId);
        case "pause": return agentsApi.pause(agentId);
        case "resume": return agentsApi.resume(agentId);
        case "terminate": return agentsApi.terminate(agentId);
        case "resetSession": return agentsApi.resetSession(agentId);
      }
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.runtimeState(agentId!) });
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
      openPanel(<AgentProperties agent={agent} runtimeState={runtimeState ?? undefined} />);
    }
    return () => closePanel();
  }, [agent, runtimeState]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!agent) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{agent.name}</h2>
          <p className="text-sm text-muted-foreground">
            {roleLabels[agent.role] ?? agent.role}
            {agent.title ? ` - ${agent.title}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => agentAction.mutate("invoke")}
            disabled={agentAction.isPending}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            Invoke
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openNewIssue({ assigneeAgentId: agentId })}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Assign Task
          </Button>
          {agent.status === "active" || agent.status === "running" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => agentAction.mutate("pause")}
              disabled={agentAction.isPending}
            >
              <Pause className="h-3.5 w-3.5 mr-1" />
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => agentAction.mutate("resume")}
              disabled={agentAction.isPending}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Resume
            </Button>
          )}
          <StatusBadge status={agent.status} />

          {/* Overflow menu */}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="end">
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                onClick={() => {
                  navigator.clipboard.writeText(agent.id);
                  setMoreOpen(false);
                }}
              >
                <Copy className="h-3 w-3" />
                Copy Agent ID
              </button>
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                onClick={() => {
                  agentAction.mutate("resetSession");
                  setMoreOpen(false);
                }}
              >
                <RotateCcw className="h-3 w-3" />
                Reset Session
              </button>
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-destructive"
                onClick={() => {
                  agentAction.mutate("terminate");
                  setMoreOpen(false);
                }}
              >
                <Trash2 className="h-3 w-3" />
                Terminate
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="runs">Runs{heartbeats ? ` (${heartbeats.length})` : ""}</TabsTrigger>
          <TabsTrigger value="issues">Issues ({assignedIssues.length})</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Summary card */}
            <div className="border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium">Summary</h3>
              <div className="space-y-2 text-sm">
                <SummaryRow label="Adapter">
                  <span className="font-mono">{adapterLabels[agent.adapterType] ?? agent.adapterType}</span>
                  {String((agent.adapterConfig as Record<string, unknown>)?.model ?? "") !== "" && (
                    <span className="text-muted-foreground ml-1">
                      ({String((agent.adapterConfig as Record<string, unknown>).model)})
                    </span>
                  )}
                </SummaryRow>
                <SummaryRow label="Heartbeat">
                  {(agent.runtimeConfig as Record<string, unknown>)?.heartbeat
                    ? (() => {
                        const hb = (agent.runtimeConfig as Record<string, unknown>).heartbeat as Record<string, unknown>;
                        if (!hb.enabled) return <span className="text-muted-foreground">Disabled</span>;
                        const sec = Number(hb.intervalSec) || 300;
                        return <span>Every {sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec}s`}</span>;
                      })()
                    : <span className="text-muted-foreground">Not configured</span>
                  }
                </SummaryRow>
                <SummaryRow label="Last heartbeat">
                  {agent.lastHeartbeatAt
                    ? <span>{relativeTime(agent.lastHeartbeatAt)}</span>
                    : <span className="text-muted-foreground">Never</span>
                  }
                </SummaryRow>
                <SummaryRow label="Session">
                  {runtimeState?.sessionId
                    ? <span className="font-mono text-xs">{runtimeState.sessionId.slice(0, 16)}...</span>
                    : <span className="text-muted-foreground">No session</span>
                  }
                </SummaryRow>
                {runtimeState && (
                  <SummaryRow label="Total spend">
                    <span>{formatCents(runtimeState.totalCostCents)}</span>
                  </SummaryRow>
                )}
              </div>
            </div>

            {/* Org card */}
            <div className="border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium">Organization</h3>
              <div className="space-y-2 text-sm">
                <SummaryRow label="Reports to">
                  {reportsToAgent ? (
                    <Link
                      to={`/agents/${reportsToAgent.id}`}
                      className="text-blue-400 hover:underline"
                    >
                      {reportsToAgent.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Nobody (top-level)</span>
                  )}
                </SummaryRow>
                {directReports.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Direct reports</span>
                    <div className="mt-1 space-y-1">
                      {directReports.map((r) => (
                        <Link
                          key={r.id}
                          to={`/agents/${r.id}`}
                          className="flex items-center gap-2 text-sm text-blue-400 hover:underline"
                        >
                          <span className="relative flex h-2 w-2">
                            <span className={`absolute inline-flex h-full w-full rounded-full ${
                              r.status === "active" ? "bg-green-400" : r.status === "error" ? "bg-red-400" : "bg-neutral-400"
                            }`} />
                          </span>
                          {r.name}
                          <span className="text-muted-foreground text-xs">({roleLabels[r.role] ?? r.role})</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {agent.capabilities && (
                  <div>
                    <span className="text-xs text-muted-foreground">Capabilities</span>
                    <p className="text-sm mt-0.5">{agent.capabilities}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* CONFIGURATION TAB */}
        <TabsContent value="configuration" className="mt-4">
          <ConfigurationTab agent={agent} />
        </TabsContent>

        {/* RUNS TAB */}
        <TabsContent value="runs" className="mt-4">
          <RunsTab runs={heartbeats ?? []} companyId={selectedCompanyId!} />
        </TabsContent>

        {/* ISSUES TAB */}
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
                  onClick={() => navigate(`/issues/${issue.id}`)}
                  trailing={<StatusBadge status={issue.status} />}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* COSTS TAB */}
        <TabsContent value="costs" className="mt-4">
          <CostsTab agent={agent} runtimeState={runtimeState ?? undefined} runs={heartbeats ?? []} />
        </TabsContent>

        {/* KEYS TAB */}
        <TabsContent value="keys" className="mt-4">
          <KeysTab agentId={agent.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---- Helper components ---- */

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

/* ---- Configuration Tab ---- */

function ConfigurationTab({ agent }: { agent: Agent }) {
  const queryClient = useQueryClient();

  const { data: adapterModels } = useQuery({
    queryKey: ["adapter-models", agent.adapterType],
    queryFn: () => agentsApi.adapterModels(agent.adapterType),
  });

  const updateAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) => agentsApi.update(agent.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
    },
  });

  return (
    <div className="max-w-2xl border border-border rounded-lg overflow-hidden">
      <AgentConfigForm
        mode="edit"
        agent={agent}
        onSave={(patch) => updateAgent.mutate(patch)}
        adapterModels={adapterModels}
      />
    </div>
  );
}

/* ---- Runs Tab ---- */

function RunsTab({ runs, companyId }: { runs: HeartbeatRun[]; companyId: string }) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No runs yet.</p>;
  }

  // Sort by created descending
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="border border-border rounded-md">
      {sorted.map((run) => {
        const statusInfo = runStatusIcons[run.status] ?? { icon: Clock, color: "text-neutral-400" };
        const StatusIcon = statusInfo.icon;
        const isExpanded = expandedRunId === run.id;
        const usage = run.usageJson as Record<string, unknown> | null;
        const totalTokens = usage
          ? (Number(usage.input_tokens ?? 0) + Number(usage.output_tokens ?? 0))
          : 0;
        const cost = usage ? Number(usage.cost_usd ?? usage.total_cost_usd ?? 0) : 0;
        const summary = run.resultJson
          ? String((run.resultJson as Record<string, unknown>).summary ?? (run.resultJson as Record<string, unknown>).result ?? "")
          : run.error ?? "";

        return (
          <div key={run.id} className="border-b border-border last:border-b-0">
            <button
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-accent/30 transition-colors text-left"
              onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
            >
              <StatusIcon className={cn("h-4 w-4 shrink-0", statusInfo.color, run.status === "running" && "animate-spin")} />
              <span className="font-mono text-xs text-muted-foreground shrink-0">
                {run.id.slice(0, 8)}
              </span>
              <span className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                run.invocationSource === "timer" ? "bg-blue-900/50 text-blue-300"
                  : run.invocationSource === "assignment" ? "bg-violet-900/50 text-violet-300"
                  : run.invocationSource === "on_demand" ? "bg-cyan-900/50 text-cyan-300"
                  : "bg-neutral-800 text-neutral-400"
              )}>
                {sourceLabels[run.invocationSource] ?? run.invocationSource}
              </span>
              <span className="flex-1 truncate text-muted-foreground text-xs">
                {summary ? summary.slice(0, 80) : ""}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                {totalTokens > 0 && (
                  <span className="text-xs text-muted-foreground">{formatTokens(totalTokens)} tok</span>
                )}
                {cost > 0 && (
                  <span className="text-xs text-muted-foreground">${cost.toFixed(3)}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {relativeTime(run.createdAt)}
                </span>
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </div>
            </button>

            {isExpanded && <RunDetail run={run} />}
          </div>
        );
      })}
    </div>
  );
}

/* ---- Run Detail (expanded) ---- */

function RunDetail({ run }: { run: HeartbeatRun }) {
  const queryClient = useQueryClient();
  const usage = run.usageJson as Record<string, unknown> | null;

  const cancelRun = useMutation({
    mutationFn: () => heartbeatsApi.cancel(run.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(run.companyId, run.agentId) });
    },
  });

  return (
    <div className="px-4 pb-4 space-y-4 bg-accent/10">
      {/* Status timeline */}
      <div className="flex items-center gap-6 text-xs">
        <div>
          <span className="text-muted-foreground">Status: </span>
          <StatusBadge status={run.status} />
        </div>
        {run.startedAt && (
          <div>
            <span className="text-muted-foreground">Started: </span>
            <span>{formatDate(run.startedAt)} {new Date(run.startedAt).toLocaleTimeString()}</span>
          </div>
        )}
        {run.finishedAt && (
          <div>
            <span className="text-muted-foreground">Finished: </span>
            <span>{formatDate(run.finishedAt)} {new Date(run.finishedAt).toLocaleTimeString()}</span>
          </div>
        )}
        {run.startedAt && run.finishedAt && (
          <div>
            <span className="text-muted-foreground">Duration: </span>
            <span>{Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s</span>
          </div>
        )}
      </div>

      {/* Token breakdown */}
      {usage && (
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-muted-foreground">Input: </span>
            <span>{formatTokens(Number(usage.input_tokens ?? 0))}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Output: </span>
            <span>{formatTokens(Number(usage.output_tokens ?? 0))}</span>
          </div>
          {Number(usage.cached_input_tokens ?? usage.cache_read_input_tokens ?? 0) > 0 && (
            <div>
              <span className="text-muted-foreground">Cached: </span>
              <span>{formatTokens(Number(usage.cached_input_tokens ?? usage.cache_read_input_tokens ?? 0))}</span>
            </div>
          )}
          {Number(usage.cost_usd ?? usage.total_cost_usd ?? 0) > 0 && (
            <div>
              <span className="text-muted-foreground">Cost: </span>
              <span>${Number(usage.cost_usd ?? usage.total_cost_usd ?? 0).toFixed(4)}</span>
            </div>
          )}
        </div>
      )}

      {/* Session info */}
      {(run.sessionIdBefore || run.sessionIdAfter) && (
        <div className="flex items-center gap-6 text-xs">
          {run.sessionIdBefore && (
            <div>
              <span className="text-muted-foreground">Session before: </span>
              <span className="font-mono">{run.sessionIdBefore.slice(0, 16)}...</span>
            </div>
          )}
          {run.sessionIdAfter && (
            <div>
              <span className="text-muted-foreground">Session after: </span>
              <span className="font-mono">{run.sessionIdAfter.slice(0, 16)}...</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {run.error && (
        <div className="text-xs">
          <span className="text-red-400">Error: </span>
          <span className="text-red-300">{run.error}</span>
          {run.errorCode && <span className="text-muted-foreground ml-2">({run.errorCode})</span>}
        </div>
      )}

      {/* Exit info */}
      {run.exitCode !== null && (
        <div className="text-xs">
          <span className="text-muted-foreground">Exit code: </span>
          <span>{run.exitCode}</span>
          {run.signal && <span className="text-muted-foreground ml-2">(signal: {run.signal})</span>}
        </div>
      )}

      {/* Cancel button for running */}
      {(run.status === "running" || run.status === "queued") && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive/30"
          onClick={() => cancelRun.mutate()}
          disabled={cancelRun.isPending}
        >
          {cancelRun.isPending ? "Cancelling..." : "Cancel Run"}
        </Button>
      )}

      <Separator />

      {/* Log viewer */}
      <LogViewer runId={run.id} status={run.status} />
    </div>
  );
}

/* ---- Log Viewer ---- */

function LogViewer({ runId, status }: { runId: string; status: string }) {
  const [events, setEvents] = useState<HeartbeatRunEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const isLive = status === "running" || status === "queued";

  // Fetch events
  const { data: initialEvents } = useQuery({
    queryKey: ["run-events", runId],
    queryFn: () => heartbeatsApi.events(runId, 0, 200),
  });

  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents);
      setLoading(false);
    }
  }, [initialEvents]);

  // Auto-scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  // Poll for live updates
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(async () => {
      const maxSeq = events.length > 0 ? Math.max(...events.map((e) => e.seq)) : 0;
      try {
        const newEvents = await heartbeatsApi.events(runId, maxSeq, 100);
        if (newEvents.length > 0) {
          setEvents((prev) => [...prev, ...newEvents]);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [runId, isLive, events]);

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading events...</p>;
  }

  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground">No log events.</p>;
  }

  const levelColors: Record<string, string> = {
    info: "text-foreground",
    warn: "text-yellow-400",
    error: "text-red-400",
  };

  const streamColors: Record<string, string> = {
    stdout: "text-foreground",
    stderr: "text-red-300",
    system: "text-blue-300",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Events ({events.length})</span>
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-cyan-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            Live
          </span>
        )}
      </div>
      <div className="bg-neutral-950 rounded-lg p-3 font-mono text-xs max-h-80 overflow-y-auto space-y-0.5">
        {events.map((evt) => {
          const color = evt.color
            ?? (evt.level ? levelColors[evt.level] : null)
            ?? (evt.stream ? streamColors[evt.stream] : null)
            ?? "text-foreground";

          return (
            <div key={evt.id} className="flex gap-2">
              <span className="text-neutral-600 shrink-0 select-none w-16">
                {new Date(evt.createdAt).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              {evt.stream && (
                <span className={cn("shrink-0 w-12", streamColors[evt.stream] ?? "text-neutral-500")}>
                  [{evt.stream}]
                </span>
              )}
              <span className={cn("break-all", color)}>
                {evt.message ?? (evt.payload ? JSON.stringify(evt.payload) : "")}
              </span>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

/* ---- Costs Tab ---- */

function CostsTab({
  agent,
  runtimeState,
  runs,
}: {
  agent: Agent;
  runtimeState?: AgentRuntimeState;
  runs: HeartbeatRun[];
}) {
  const budgetPct =
    agent.budgetMonthlyCents > 0
      ? Math.round((agent.spentMonthlyCents / agent.budgetMonthlyCents) * 100)
      : 0;

  const runsWithCost = runs
    .filter((r) => {
      const u = r.usageJson as Record<string, unknown> | null;
      return u && (u.cost_usd || u.total_cost_usd || u.input_tokens);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Cumulative totals */}
      {runtimeState && (
        <div className="border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Cumulative Totals</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-muted-foreground block">Input tokens</span>
              <span className="text-lg font-semibold">{formatTokens(runtimeState.totalInputTokens)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Output tokens</span>
              <span className="text-lg font-semibold">{formatTokens(runtimeState.totalOutputTokens)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Cached tokens</span>
              <span className="text-lg font-semibold">{formatTokens(runtimeState.totalCachedInputTokens)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Total cost</span>
              <span className="text-lg font-semibold">{formatCents(runtimeState.totalCostCents)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Monthly budget */}
      <div className="border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3">Monthly Budget</h3>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">Utilization</span>
          <span>
            {formatCents(agent.spentMonthlyCents)} / {formatCents(agent.budgetMonthlyCents)}
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              budgetPct > 90 ? "bg-red-400" : budgetPct > 70 ? "bg-yellow-400" : "bg-green-400"
            )}
            style={{ width: `${Math.min(100, budgetPct)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{budgetPct}% utilized</p>
      </div>

      {/* Per-run cost table */}
      {runsWithCost.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">Per-Run Costs</h3>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-accent/20">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Run</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Input</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Output</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost</th>
                </tr>
              </thead>
              <tbody>
                {runsWithCost.map((run) => {
                  const u = run.usageJson as Record<string, unknown>;
                  return (
                    <tr key={run.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2">{formatDate(run.createdAt)}</td>
                      <td className="px-3 py-2 font-mono">{run.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-right">{formatTokens(Number(u.input_tokens ?? 0))}</td>
                      <td className="px-3 py-2 text-right">{formatTokens(Number(u.output_tokens ?? 0))}</td>
                      <td className="px-3 py-2 text-right">
                        {(u.cost_usd || u.total_cost_usd)
                          ? `$${Number(u.cost_usd ?? u.total_cost_usd ?? 0).toFixed(4)}`
                          : "-"
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Keys Tab ---- */

function KeysTab({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: keys, isLoading } = useQuery({
    queryKey: queryKeys.agents.keys(agentId),
    queryFn: () => agentsApi.listKeys(agentId),
  });

  const createKey = useMutation({
    mutationFn: () => agentsApi.createKey(agentId, newKeyName.trim() || "Default"),
    onSuccess: (data) => {
      setNewToken(data.token);
      setTokenVisible(true);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.keys(agentId) });
    },
  });

  const revokeKey = useMutation({
    mutationFn: (keyId: string) => agentsApi.revokeKey(agentId, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.keys(agentId) });
    },
  });

  function copyToken() {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeKeys = (keys ?? []).filter((k: AgentKey) => !k.revokedAt);
  const revokedKeys = (keys ?? []).filter((k: AgentKey) => k.revokedAt);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* New token banner */}
      {newToken && (
        <div className="border border-yellow-600/40 bg-yellow-500/5 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-yellow-400">
            API key created — copy it now, it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-neutral-950 rounded px-3 py-1.5 text-xs font-mono text-green-300 truncate">
              {tokenVisible ? newToken : newToken.replace(/./g, "•")}
            </code>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTokenVisible((v) => !v)}
              title={tokenVisible ? "Hide" : "Show"}
            >
              {tokenVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={copyToken}
              title="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {copied && <span className="text-xs text-green-400">Copied!</span>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs"
            onClick={() => setNewToken(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Create new key */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Key className="h-4 w-4" />
          Create API Key
        </h3>
        <p className="text-xs text-muted-foreground">
          API keys allow this agent to authenticate calls to the Paperclip server.
        </p>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Key name (e.g. production)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") createKey.mutate();
            }}
          />
          <Button
            size="sm"
            onClick={() => createKey.mutate()}
            disabled={createKey.isPending}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create
          </Button>
        </div>
      </div>

      {/* Active keys */}
      {isLoading && <p className="text-sm text-muted-foreground">Loading keys...</p>}

      {!isLoading && activeKeys.length === 0 && !newToken && (
        <p className="text-sm text-muted-foreground">No active API keys.</p>
      )}

      {activeKeys.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Active Keys
          </h3>
          <div className="border border-border rounded-md divide-y divide-border">
            {activeKeys.map((key: AgentKey) => (
              <div key={key.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium">{key.name}</span>
                  <span className="text-xs text-muted-foreground ml-3">
                    Created {formatDate(key.createdAt)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive text-xs"
                  onClick={() => revokeKey.mutate(key.id)}
                  disabled={revokeKey.isPending}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revoked keys (collapsed) */}
      {revokedKeys.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Revoked Keys
          </h3>
          <div className="border border-border rounded-md divide-y divide-border opacity-50">
            {revokedKeys.map((key: AgentKey) => (
              <div key={key.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm line-through">{key.name}</span>
                  <span className="text-xs text-muted-foreground ml-3">
                    Revoked {key.revokedAt ? formatDate(key.revokedAt) : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
