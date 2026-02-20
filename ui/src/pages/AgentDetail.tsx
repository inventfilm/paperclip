import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, Link, useBeforeUnload } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi, type AgentKey } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { usePanel } from "../context/PanelContext";
import { useSidebar } from "../context/SidebarContext";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { AgentConfigForm } from "../components/AgentConfigForm";
import { PageTabBar } from "../components/PageTabBar";
import { adapterLabels, roleLabels } from "../components/agent-config-primitives";
import { getUIAdapter, buildTranscript } from "../adapters";
import type { TranscriptEntry } from "../adapters";
import { StatusBadge } from "../components/StatusBadge";
import { CopyText } from "../components/CopyText";
import { EntityRow } from "../components/EntityRow";
import { Identity } from "../components/Identity";
import { formatCents, formatDate, relativeTime, formatTokens } from "../lib/utils";
import { cn } from "../lib/utils";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
  ChevronRight,
  ArrowLeft,
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

const REDACTED_ENV_VALUE = "***REDACTED***";
const SECRET_ENV_KEY_RE =
  /(api[-_]?key|access[-_]?token|auth(?:_?token)?|authorization|bearer|secret|passwd|password|credential|jwt|private[-_]?key|cookie|connectionstring)/i;
const JWT_VALUE_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?$/;

function shouldRedactSecretValue(key: string, value: unknown): boolean {
  if (SECRET_ENV_KEY_RE.test(key)) return true;
  if (typeof value !== "string") return false;
  return JWT_VALUE_RE.test(value);
}

function redactEnvValue(key: string, value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "secret_ref"
  ) {
    return "***SECRET_REF***";
  }
  if (shouldRedactSecretValue(key, value)) return REDACTED_ENV_VALUE;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatEnvForDisplay(envValue: unknown): string {
  const env = asRecord(envValue);
  if (!env) return "<unable-to-parse>";

  const keys = Object.keys(env);
  if (keys.length === 0) return "<empty>";

  return keys
    .sort()
    .map((key) => `${key}=${redactEnvValue(key, env[key])}`)
    .join("\n");
}

const sourceLabels: Record<string, string> = {
  timer: "Timer",
  assignment: "Assignment",
  on_demand: "On-demand",
  automation: "Automation",
};

const LIVE_SCROLL_BOTTOM_TOLERANCE_PX = 32;
type ScrollContainer = Window | HTMLElement;

function isWindowContainer(container: ScrollContainer): container is Window {
  return container === window;
}

function isElementScrollContainer(element: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(element).overflowY;
  return overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
}

function findScrollContainer(anchor: HTMLElement | null): ScrollContainer {
  let parent = anchor?.parentElement ?? null;
  while (parent) {
    if (isElementScrollContainer(parent)) return parent;
    parent = parent.parentElement;
  }
  return window;
}

function readScrollMetrics(container: ScrollContainer): { scrollHeight: number; distanceFromBottom: number } {
  if (isWindowContainer(container)) {
    const pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const viewportBottom = window.scrollY + window.innerHeight;
    return {
      scrollHeight: pageHeight,
      distanceFromBottom: Math.max(0, pageHeight - viewportBottom),
    };
  }

  const viewportBottom = container.scrollTop + container.clientHeight;
  return {
    scrollHeight: container.scrollHeight,
    distanceFromBottom: Math.max(0, container.scrollHeight - viewportBottom),
  };
}

function scrollToContainerBottom(container: ScrollContainer, behavior: ScrollBehavior = "auto") {
  if (isWindowContainer(container)) {
    const pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    window.scrollTo({ top: pageHeight, behavior });
    return;
  }

  container.scrollTo({ top: container.scrollHeight, behavior });
}

type AgentDetailTab = "overview" | "configuration" | "runs" | "issues" | "costs" | "keys";

function parseAgentDetailTab(value: string | null): AgentDetailTab {
  if (value === "configuration") return value;
  if (value === "runs") return value;
  if (value === "issues") return value;
  if (value === "costs") return value;
  if (value === "keys") return value;
  return "overview";
}

function usageNumber(usage: Record<string, unknown> | null, ...keys: string[]) {
  if (!usage) return 0;
  for (const key of keys) {
    const value = usage[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function runMetrics(run: HeartbeatRun) {
  const usage = (run.usageJson ?? null) as Record<string, unknown> | null;
  const result = (run.resultJson ?? null) as Record<string, unknown> | null;
  const input = usageNumber(usage, "inputTokens", "input_tokens");
  const output = usageNumber(usage, "outputTokens", "output_tokens");
  const cached = usageNumber(
    usage,
    "cachedInputTokens",
    "cached_input_tokens",
    "cache_read_input_tokens",
  );
  const cost =
    usageNumber(usage, "costUsd", "cost_usd", "total_cost_usd") ||
    usageNumber(result, "total_cost_usd", "cost_usd", "costUsd");
  return {
    input,
    output,
    cached,
    cost,
    totalTokens: input + output,
  };
}

type RunLogChunk = { ts: string; stream: "stdout" | "stderr" | "system"; chunk: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function AgentDetail() {
  const { agentId, tab: urlTab, runId: urlRunId } = useParams<{ agentId: string; tab?: string; runId?: string }>();
  const { selectedCompanyId } = useCompany();
  const { closePanel } = usePanel();
  const { openNewIssue } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const activeTab = urlRunId ? "runs" as AgentDetailTab : parseAgentDetailTab(urlTab ?? null);
  const [configDirty, setConfigDirty] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const saveConfigActionRef = useRef<(() => void) | null>(null);
  const cancelConfigActionRef = useRef<(() => void) | null>(null);
  const { isMobile } = useSidebar();
  const setSaveConfigAction = useCallback((fn: (() => void) | null) => { saveConfigActionRef.current = fn; }, []);
  const setCancelConfigAction = useCallback((fn: (() => void) | null) => { cancelConfigActionRef.current = fn; }, []);

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
  const directReports = (allAgents ?? []).filter((a) => a.reportsTo === agentId && a.status !== "terminated");
  const mobileLiveRun = useMemo(
    () => (heartbeats ?? []).find((r) => r.status === "running" || r.status === "queued") ?? null,
    [heartbeats],
  );

  const agentAction = useMutation({
    mutationFn: async (action: "invoke" | "pause" | "resume" | "terminate") => {
      if (!agentId) return Promise.reject(new Error("No agent ID"));
      switch (action) {
        case "invoke": return agentsApi.invoke(agentId);
        case "pause": return agentsApi.pause(agentId);
        case "resume": return agentsApi.resume(agentId);
        case "terminate": return agentsApi.terminate(agentId);
      }
    },
    onSuccess: (data, action) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.runtimeState(agentId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.taskSessions(agentId!) });
      if (selectedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId) });
      }
      if (action === "invoke" && data && typeof data === "object" && "id" in data) {
        navigate(`/agents/${agentId}/runs/${(data as HeartbeatRun).id}`);
      }
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Action failed");
    },
  });

  const resetTaskSession = useMutation({
    mutationFn: (taskKey: string | null) => agentsApi.resetSession(agentId!, taskKey),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.runtimeState(agentId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.taskSessions(agentId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reset session");
    },
  });

  const updatePermissions = useMutation({
    mutationFn: (canCreateAgents: boolean) =>
      agentsApi.updatePermissions(agentId!, { canCreateAgents }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId!) });
      if (selectedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId) });
      }
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to update permissions");
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Agents", href: "/agents" },
      { label: agent?.name ?? agentId ?? "Agent" },
    ]);
  }, [setBreadcrumbs, agent, agentId]);

  useEffect(() => {
    closePanel();
    return () => closePanel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useBeforeUnload(
    useCallback((event) => {
      if (!configDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }, [configDirty]),
  );

  const setActiveTab = useCallback((nextTab: string) => {
    if (configDirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    const next = parseAgentDetailTab(nextTab);
    navigate(`/agents/${agentId}/${next}`, { replace: !!urlRunId });
  }, [agentId, navigate, configDirty, urlRunId]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!agent) return null;
  const isPendingApproval = agent.status === "pending_approval";
  const showConfigActionBar = activeTab === "configuration" && configDirty;

  return (
    <div className={cn("space-y-6", isMobile && showConfigActionBar && "pb-24")}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold truncate">{agent.name}</h2>
          <p className="text-sm text-muted-foreground truncate">
            {roleLabels[agent.role] ?? agent.role}
            {agent.title ? ` - ${agent.title}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openNewIssue({ assigneeAgentId: agentId })}
          >
            <Plus className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Assign Task</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => agentAction.mutate("invoke")}
            disabled={agentAction.isPending || isPendingApproval}
          >
            <Play className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Invoke</span>
          </Button>
          {agent.status === "paused" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => agentAction.mutate("resume")}
              disabled={agentAction.isPending || isPendingApproval}
            >
              <Play className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Resume</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => agentAction.mutate("pause")}
              disabled={agentAction.isPending || isPendingApproval}
            >
              <Pause className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Pause</span>
            </Button>
          )}
          <span className="hidden sm:inline"><StatusBadge status={agent.status} /></span>
          {mobileLiveRun && (
            <button
              className="sm:hidden flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
              onClick={() => navigate(`/agents/${agent.id}/runs/${mobileLiveRun.id}`)}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-[11px] font-medium text-blue-400">Live</span>
            </button>
          )}

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
                  resetTaskSession.mutate(null);
                  setMoreOpen(false);
                }}
              >
                <RotateCcw className="h-3 w-3" />
                Reset Sessions
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
      {isPendingApproval && (
        <p className="text-sm text-amber-500">
          This agent is pending board approval and cannot be invoked yet.
        </p>
      )}

      {/* Floating Save/Cancel (desktop) */}
      {!isMobile && (
        <div
          className={cn(
            "sticky top-6 z-10 float-right transition-opacity duration-150",
            showConfigActionBar
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelConfigActionRef.current?.()}
              disabled={configSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveConfigActionRef.current?.()}
              disabled={configSaving}
            >
              {configSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile bottom Save/Cancel bar */}
      {isMobile && showConfigActionBar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm">
          <div
            className="flex items-center justify-end gap-2 px-3 py-2"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelConfigActionRef.current?.()}
              disabled={configSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveConfigActionRef.current?.()}
              disabled={configSaving}
            >
              {configSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <PageTabBar
          items={[
            { value: "overview", label: "Overview" },
            { value: "runs", label: "Runs" },
            { value: "configuration", label: "Configuration" },
            { value: "issues", label: `Issues (${assignedIssues.length})` },
            { value: "costs", label: "Costs" },
            { value: "keys", label: "API Keys" },
          ]}
          value={activeTab}
          onValueChange={setActiveTab}
        />

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
                        const maxConcurrentRuns = Math.max(1, Math.floor(Number(hb.maxConcurrentRuns) || 1));
                        const intervalLabel = sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec}s`;
                        return (
                          <span>
                            Every {intervalLabel}
                            {maxConcurrentRuns > 1 ? ` (max ${maxConcurrentRuns} concurrent)` : ""}
                          </span>
                        );
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
                      <Identity name={reportsToAgent.name} size="sm" />
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
                              r.status === "active"
                                ? "bg-green-400"
                                : r.status === "pending_approval"
                                  ? "bg-amber-400"
                                  : r.status === "error"
                                    ? "bg-red-400"
                                    : "bg-neutral-400"
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

          <LatestRunCard runs={heartbeats ?? []} agentId={agentId!} />
        </TabsContent>

        {/* RUNS TAB */}
        <TabsContent value="runs" className="mt-4">
          <RunsTab runs={heartbeats ?? []} companyId={selectedCompanyId!} agentId={agentId!} selectedRunId={urlRunId ?? null} adapterType={agent.adapterType} />
        </TabsContent>

        {/* CONFIGURATION TAB */}
        <TabsContent value="configuration" className="mt-4">
          <ConfigurationTab
            agent={agent}
            onDirtyChange={setConfigDirty}
            onSaveActionChange={setSaveConfigAction}
            onCancelActionChange={setCancelConfigAction}
            onSavingChange={setConfigSaving}
            updatePermissions={updatePermissions}
          />
        </TabsContent>

        {/* ISSUES TAB */}
        <TabsContent value="issues" className="mt-4">
          {assignedIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assigned issues.</p>
          ) : (
            <div className="border border-border">
              {assignedIssues.map((issue) => (
                <EntityRow
                  key={issue.id}
                  identifier={issue.identifier ?? issue.id.slice(0, 8)}
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
          <CostsTab runtimeState={runtimeState ?? undefined} runs={heartbeats ?? []} />
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

function LatestRunCard({ runs, agentId }: { runs: HeartbeatRun[]; agentId: string }) {
  const navigate = useNavigate();

  if (runs.length === 0) return null;

  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const liveRun = sorted.find((r) => r.status === "running" || r.status === "queued");
  const run = liveRun ?? sorted[0];
  const isLive = run.status === "running" || run.status === "queued";
  const metrics = runMetrics(run);
  const statusInfo = runStatusIcons[run.status] ?? { icon: Clock, color: "text-neutral-400" };
  const StatusIcon = statusInfo.icon;
  const summary = run.resultJson
    ? String((run.resultJson as Record<string, unknown>).summary ?? (run.resultJson as Record<string, unknown>).result ?? "")
    : run.error ?? "";

  return (
    <div className={cn(
      "border rounded-lg p-4 space-y-3",
      isLive ? "border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.08)]" : "border-border"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
          )}
          <h3 className="text-sm font-medium">{isLive ? "Live Run" : "Latest Run"}</h3>
        </div>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => navigate(`/agents/${agentId}/runs/${run.id}`)}
        >
          View details &rarr;
        </button>
      </div>

      <div className="flex items-center gap-2">
        <StatusIcon className={cn("h-3.5 w-3.5", statusInfo.color, run.status === "running" && "animate-spin")} />
        <StatusBadge status={run.status} />
        <span className="font-mono text-xs text-muted-foreground">{run.id.slice(0, 8)}</span>
        <span className={cn(
          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
          run.invocationSource === "timer" ? "bg-blue-900/50 text-blue-300"
            : run.invocationSource === "assignment" ? "bg-violet-900/50 text-violet-300"
            : run.invocationSource === "on_demand" ? "bg-cyan-900/50 text-cyan-300"
            : "bg-neutral-800 text-neutral-400"
        )}>
          {sourceLabels[run.invocationSource] ?? run.invocationSource}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{relativeTime(run.createdAt)}</span>
      </div>

      {summary && (
        <p className="text-xs text-muted-foreground truncate">{summary}</p>
      )}

      {(metrics.totalTokens > 0 || metrics.cost > 0) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {metrics.totalTokens > 0 && <span>{formatTokens(metrics.totalTokens)} tokens</span>}
          {metrics.cost > 0 && <span>${metrics.cost.toFixed(3)}</span>}
        </div>
      )}
    </div>
  );
}

/* ---- Configuration Tab ---- */

function ConfigurationTab({
  agent,
  onDirtyChange,
  onSaveActionChange,
  onCancelActionChange,
  onSavingChange,
  updatePermissions,
}: {
  agent: Agent;
  onDirtyChange: (dirty: boolean) => void;
  onSaveActionChange: (save: (() => void) | null) => void;
  onCancelActionChange: (cancel: (() => void) | null) => void;
  onSavingChange: (saving: boolean) => void;
  updatePermissions: { mutate: (canCreate: boolean) => void; isPending: boolean };
}) {
  const queryClient = useQueryClient();

  const { data: adapterModels } = useQuery({
    queryKey: ["adapter-models", agent.adapterType],
    queryFn: () => agentsApi.adapterModels(agent.adapterType),
  });

  const updateAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) => agentsApi.update(agent.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.configRevisions(agent.id) });
    },
  });

  const { data: configRevisions } = useQuery({
    queryKey: queryKeys.agents.configRevisions(agent.id),
    queryFn: () => agentsApi.listConfigRevisions(agent.id),
  });

  const rollbackConfig = useMutation({
    mutationFn: (revisionId: string) => agentsApi.rollbackConfigRevision(agent.id, revisionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.configRevisions(agent.id) });
    },
  });

  useEffect(() => {
    onSavingChange(updateAgent.isPending);
  }, [onSavingChange, updateAgent.isPending]);

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg overflow-hidden">
        <AgentConfigForm
          mode="edit"
          agent={agent}
          onSave={(patch) => updateAgent.mutate(patch)}
          isSaving={updateAgent.isPending}
          adapterModels={adapterModels}
          onDirtyChange={onDirtyChange}
          onSaveActionChange={onSaveActionChange}
          onCancelActionChange={onCancelActionChange}
          hideInlineSave
        />
      </div>
      <div className="border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium">Permissions</h3>
        <div className="flex items-center justify-between text-sm">
          <span>Can create new agents</span>
          <Button
            variant={agent.permissions?.canCreateAgents ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() =>
              updatePermissions.mutate(!Boolean(agent.permissions?.canCreateAgents))
            }
            disabled={updatePermissions.isPending}
          >
            {agent.permissions?.canCreateAgents ? "Enabled" : "Disabled"}
          </Button>
        </div>
      </div>
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Configuration Revisions</h3>
          <span className="text-xs text-muted-foreground">{configRevisions?.length ?? 0}</span>
        </div>
        {(configRevisions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No configuration revisions yet.</p>
        ) : (
          <div className="space-y-2">
            {(configRevisions ?? []).slice(0, 10).map((revision) => (
              <div key={revision.id} className="border border-border/70 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{revision.id.slice(0, 8)}</span>
                    <span className="mx-1">·</span>
                    <span>{formatDate(revision.createdAt)}</span>
                    <span className="mx-1">·</span>
                    <span>{revision.source}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => rollbackConfig.mutate(revision.id)}
                    disabled={rollbackConfig.isPending}
                  >
                    Restore
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Changed:{" "}
                  {revision.changedKeys.length > 0 ? revision.changedKeys.join(", ") : "no tracked changes"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Runs Tab ---- */

function RunListItem({ run, isSelected, agentId }: { run: HeartbeatRun; isSelected: boolean; agentId: string }) {
  const navigate = useNavigate();
  const statusInfo = runStatusIcons[run.status] ?? { icon: Clock, color: "text-neutral-400" };
  const StatusIcon = statusInfo.icon;
  const metrics = runMetrics(run);
  const summary = run.resultJson
    ? String((run.resultJson as Record<string, unknown>).summary ?? (run.resultJson as Record<string, unknown>).result ?? "")
    : run.error ?? "";

  return (
    <button
      className={cn(
        "flex flex-col gap-1 w-full px-3 py-2.5 text-left border-b border-border last:border-b-0 transition-colors",
        isSelected ? "bg-accent/40" : "hover:bg-accent/20",
      )}
      onClick={() => navigate(isSelected ? `/agents/${agentId}/runs` : `/agents/${agentId}/runs/${run.id}`)}
    >
      <div className="flex items-center gap-2">
        <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", statusInfo.color, run.status === "running" && "animate-spin")} />
        <span className="font-mono text-xs text-muted-foreground">
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
        <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
          {relativeTime(run.createdAt)}
        </span>
      </div>
      {summary && (
        <span className="text-xs text-muted-foreground truncate pl-5.5">
          {summary.slice(0, 60)}
        </span>
      )}
      {(metrics.totalTokens > 0 || metrics.cost > 0) && (
        <div className="flex items-center gap-2 pl-5.5 text-[11px] text-muted-foreground">
          {metrics.totalTokens > 0 && <span>{formatTokens(metrics.totalTokens)} tok</span>}
          {metrics.cost > 0 && <span>${metrics.cost.toFixed(3)}</span>}
        </div>
      )}
    </button>
  );
}

function RunsTab({ runs, companyId, agentId, selectedRunId, adapterType }: { runs: HeartbeatRun[]; companyId: string; agentId: string; selectedRunId: string | null; adapterType: string }) {
  const navigate = useNavigate();
  const { isMobile } = useSidebar();

  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No runs yet.</p>;
  }

  // Sort by created descending
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // On mobile, don't auto-select so the list shows first; on desktop, auto-select latest
  const effectiveRunId = isMobile ? selectedRunId : (selectedRunId ?? sorted[0]?.id ?? null);
  const selectedRun = sorted.find((r) => r.id === effectiveRunId) ?? null;

  // Mobile: show either run list OR run detail with back button
  if (isMobile) {
    if (selectedRun) {
      return (
        <div className="space-y-3">
          <button
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate(`/agents/${agentId}/runs`)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to runs
          </button>
          <RunDetail key={selectedRun.id} run={selectedRun} adapterType={adapterType} />
        </div>
      );
    }
    return (
      <div className="border border-border rounded-lg">
        {sorted.map((run) => (
          <RunListItem key={run.id} run={run} isSelected={false} agentId={agentId} />
        ))}
      </div>
    );
  }

  // Desktop: side-by-side layout
  return (
    <div className="flex gap-0">
      {/* Left: run list — border stretches full height, content sticks */}
      <div className={cn(
        "shrink-0 border border-border rounded-lg",
        selectedRun ? "w-72" : "w-full",
      )}>
        <div className="sticky top-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 2rem)" }}>
        {sorted.map((run) => (
          <RunListItem key={run.id} run={run} isSelected={run.id === effectiveRunId} agentId={agentId} />
        ))}
        </div>
      </div>

      {/* Right: run detail — natural height, page scrolls */}
      {selectedRun && (
        <div className="flex-1 min-w-0 pl-4">
          <RunDetail key={selectedRun.id} run={selectedRun} adapterType={adapterType} />
        </div>
      )}
    </div>
  );
}

/* ---- Run Detail (expanded) ---- */

function RunDetail({ run, adapterType }: { run: HeartbeatRun; adapterType: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const metrics = runMetrics(run);
  const [sessionOpen, setSessionOpen] = useState(false);

  const cancelRun = useMutation({
    mutationFn: () => heartbeatsApi.cancel(run.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(run.companyId, run.agentId) });
    },
  });

  const { data: touchedIssues } = useQuery({
    queryKey: queryKeys.runIssues(run.id),
    queryFn: () => activityApi.issuesForRun(run.id),
  });
  const touchedIssueIds = useMemo(
    () => Array.from(new Set((touchedIssues ?? []).map((issue) => issue.issueId))),
    [touchedIssues],
  );

  const clearSessionsForTouchedIssues = useMutation({
    mutationFn: async () => {
      if (touchedIssueIds.length === 0) return 0;
      await Promise.all(touchedIssueIds.map((issueId) => agentsApi.resetSession(run.agentId, issueId)));
      return touchedIssueIds.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.runtimeState(run.agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.taskSessions(run.agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.runIssues(run.id) });
    },
  });

  const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
  const startTime = run.startedAt ? new Date(run.startedAt).toLocaleTimeString("en-US", timeFormat) : null;
  const endTime = run.finishedAt ? new Date(run.finishedAt).toLocaleTimeString("en-US", timeFormat) : null;
  const durationSec = run.startedAt && run.finishedAt
    ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;
  const hasMetrics = metrics.input > 0 || metrics.output > 0 || metrics.cached > 0 || metrics.cost > 0;
  const hasSession = !!(run.sessionIdBefore || run.sessionIdAfter);
  const sessionChanged = run.sessionIdBefore && run.sessionIdAfter && run.sessionIdBefore !== run.sessionIdAfter;
  const sessionId = run.sessionIdAfter || run.sessionIdBefore;
  const hasNonZeroExit = run.exitCode !== null && run.exitCode !== 0;

  return (
    <div className="space-y-4">
      {/* Run summary card */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex">
          {/* Left column: status + timing */}
          <div className="flex-1 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={run.status} />
              {(run.status === "running" || run.status === "queued") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive text-xs h-6 px-2"
                  onClick={() => cancelRun.mutate()}
                  disabled={cancelRun.isPending}
                >
                  {cancelRun.isPending ? "Cancelling..." : "Cancel"}
                </Button>
              )}
            </div>
            {startTime && (
              <div className="space-y-0.5">
                <div className="text-sm font-mono">
                  {startTime}
                  {endTime && <span className="text-muted-foreground"> &rarr; </span>}
                  {endTime}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {relativeTime(run.startedAt!)}
                  {run.finishedAt && <> &rarr; {relativeTime(run.finishedAt)}</>}
                </div>
                {durationSec !== null && (
                  <div className="text-xs text-muted-foreground">
                    Duration: {durationSec >= 60 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : `${durationSec}s`}
                  </div>
                )}
              </div>
            )}
            {run.error && (
              <div className="text-xs">
                <span className="text-red-400">{run.error}</span>
                {run.errorCode && <span className="text-muted-foreground ml-1">({run.errorCode})</span>}
              </div>
            )}
            {hasNonZeroExit && (
              <div className="text-xs text-red-400">
                Exit code {run.exitCode}
                {run.signal && <span className="text-muted-foreground ml-1">(signal: {run.signal})</span>}
              </div>
            )}
          </div>

          {/* Right column: metrics */}
          {hasMetrics && (
            <div className="border-l border-border p-4 grid grid-cols-2 gap-x-8 gap-y-3 content-center">
              <div>
                <div className="text-xs text-muted-foreground">Input</div>
                <div className="text-sm font-medium font-mono">{formatTokens(metrics.input)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Output</div>
                <div className="text-sm font-medium font-mono">{formatTokens(metrics.output)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cached</div>
                <div className="text-sm font-medium font-mono">{formatTokens(metrics.cached)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cost</div>
                <div className="text-sm font-medium font-mono">{metrics.cost > 0 ? `$${metrics.cost.toFixed(4)}` : "-"}</div>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible session row */}
        {hasSession && (
          <div className="border-t border-border">
            <button
              className="flex items-center gap-1.5 w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSessionOpen((v) => !v)}
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", sessionOpen && "rotate-90")} />
              Session
              {sessionChanged && <span className="text-yellow-400 ml-1">(changed)</span>}
            </button>
            {sessionOpen && (
              <div className="px-4 pb-3 space-y-1 text-xs">
                {run.sessionIdBefore && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-12">{sessionChanged ? "Before" : "ID"}</span>
                    <CopyText text={run.sessionIdBefore} className="font-mono" />
                  </div>
                )}
                {sessionChanged && run.sessionIdAfter && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-12">After</span>
                    <CopyText text={run.sessionIdAfter} className="font-mono" />
                  </div>
                )}
                {touchedIssueIds.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-60"
                      disabled={clearSessionsForTouchedIssues.isPending}
                      onClick={() => {
                        const issueCount = touchedIssueIds.length;
                        const confirmed = window.confirm(
                          `Clear session for ${issueCount} issue${issueCount === 1 ? "" : "s"} touched by this run?`,
                        );
                        if (!confirmed) return;
                        clearSessionsForTouchedIssues.mutate();
                      }}
                    >
                      {clearSessionsForTouchedIssues.isPending
                        ? "clearing session..."
                        : "clear session for these issues"}
                    </button>
                    {clearSessionsForTouchedIssues.isError && (
                      <p className="text-[11px] text-destructive mt-1">
                        {clearSessionsForTouchedIssues.error instanceof Error
                          ? clearSessionsForTouchedIssues.error.message
                          : "Failed to clear sessions"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Issues touched by this run */}
      {touchedIssues && touchedIssues.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Issues Touched ({touchedIssues.length})</span>
          <div className="border border-border rounded-lg divide-y divide-border">
            {touchedIssues.map((issue) => (
              <button
                key={issue.issueId}
                className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-accent/20 transition-colors text-left"
                onClick={() => navigate(`/issues/${issue.issueId}`)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={issue.status} />
                  <span className="truncate">{issue.title}</span>
                </div>
                <span className="font-mono text-muted-foreground shrink-0 ml-2">{issue.issueId.slice(0, 8)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* stderr excerpt for failed runs */}
      {run.stderrExcerpt && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-red-400">stderr</span>
          <pre className="bg-neutral-950 rounded-md p-3 text-xs font-mono text-red-300 overflow-x-auto whitespace-pre-wrap">{run.stderrExcerpt}</pre>
        </div>
      )}

      {/* stdout excerpt when no log is available */}
      {run.stdoutExcerpt && !run.logRef && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">stdout</span>
          <pre className="bg-neutral-950 rounded-md p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">{run.stdoutExcerpt}</pre>
        </div>
      )}

      {/* Log viewer */}
      <LogViewer run={run} adapterType={adapterType} />
    </div>
  );
}

/* ---- Log Viewer ---- */

function LogViewer({ run, adapterType }: { run: HeartbeatRun; adapterType: string }) {
  const [events, setEvents] = useState<HeartbeatRunEvent[]>([]);
  const [logLines, setLogLines] = useState<Array<{ ts: string; stream: "stdout" | "stderr" | "system"; chunk: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(!!run.logRef);
  const [logError, setLogError] = useState<string | null>(null);
  const [logOffset, setLogOffset] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pendingLogLineRef = useRef("");
  const scrollContainerRef = useRef<ScrollContainer | null>(null);
  const isFollowingRef = useRef(false);
  const lastMetricsRef = useRef<{ scrollHeight: number; distanceFromBottom: number }>({
    scrollHeight: 0,
    distanceFromBottom: Number.POSITIVE_INFINITY,
  });
  const isLive = run.status === "running" || run.status === "queued";

  function appendLogContent(content: string, finalize = false) {
    if (!content && !finalize) return;
    const combined = `${pendingLogLineRef.current}${content}`;
    const split = combined.split("\n");
    pendingLogLineRef.current = split.pop() ?? "";
    if (finalize && pendingLogLineRef.current) {
      split.push(pendingLogLineRef.current);
      pendingLogLineRef.current = "";
    }

    const parsed: Array<{ ts: string; stream: "stdout" | "stderr" | "system"; chunk: string }> = [];
    for (const line of split) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const raw = JSON.parse(trimmed) as { ts?: unknown; stream?: unknown; chunk?: unknown };
        const stream =
          raw.stream === "stderr" || raw.stream === "system" ? raw.stream : "stdout";
        const chunk = typeof raw.chunk === "string" ? raw.chunk : "";
        const ts = typeof raw.ts === "string" ? raw.ts : new Date().toISOString();
        if (!chunk) continue;
        parsed.push({ ts, stream, chunk });
      } catch {
        // ignore malformed lines
      }
    }

    if (parsed.length > 0) {
      setLogLines((prev) => [...prev, ...parsed]);
    }
  }

  // Fetch events
  const { data: initialEvents } = useQuery({
    queryKey: ["run-events", run.id],
    queryFn: () => heartbeatsApi.events(run.id, 0, 200),
  });

  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents);
      setLoading(false);
    }
  }, [initialEvents]);

  const getScrollContainer = useCallback((): ScrollContainer => {
    if (scrollContainerRef.current) return scrollContainerRef.current;
    const container = findScrollContainer(logEndRef.current);
    scrollContainerRef.current = container;
    return container;
  }, []);

  const updateFollowingState = useCallback(() => {
    const container = getScrollContainer();
    const metrics = readScrollMetrics(container);
    lastMetricsRef.current = metrics;
    const nearBottom = metrics.distanceFromBottom <= LIVE_SCROLL_BOTTOM_TOLERANCE_PX;
    isFollowingRef.current = nearBottom;
    setIsFollowing((prev) => (prev === nearBottom ? prev : nearBottom));
  }, [getScrollContainer]);

  useEffect(() => {
    scrollContainerRef.current = null;
    lastMetricsRef.current = {
      scrollHeight: 0,
      distanceFromBottom: Number.POSITIVE_INFINITY,
    };

    if (!isLive) {
      isFollowingRef.current = false;
      setIsFollowing(false);
      return;
    }

    updateFollowingState();
  }, [isLive, run.id, updateFollowingState]);

  useEffect(() => {
    if (!isLive) return;
    const container = getScrollContainer();
    updateFollowingState();

    if (container === window) {
      window.addEventListener("scroll", updateFollowingState, { passive: true });
    } else {
      container.addEventListener("scroll", updateFollowingState, { passive: true });
    }
    window.addEventListener("resize", updateFollowingState);
    return () => {
      if (container === window) {
        window.removeEventListener("scroll", updateFollowingState);
      } else {
        container.removeEventListener("scroll", updateFollowingState);
      }
      window.removeEventListener("resize", updateFollowingState);
    };
  }, [isLive, run.id, getScrollContainer, updateFollowingState]);

  // Auto-scroll only for live runs when following
  useEffect(() => {
    if (!isLive || !isFollowingRef.current) return;

    const container = getScrollContainer();
    const previous = lastMetricsRef.current;
    const current = readScrollMetrics(container);
    const growth = Math.max(0, current.scrollHeight - previous.scrollHeight);
    const expectedDistance = previous.distanceFromBottom + growth;
    const movedAwayBy = current.distanceFromBottom - expectedDistance;

    // If user moved away from bottom between updates, release auto-follow immediately.
    if (movedAwayBy > LIVE_SCROLL_BOTTOM_TOLERANCE_PX) {
      isFollowingRef.current = false;
      setIsFollowing(false);
      lastMetricsRef.current = current;
      return;
    }

    scrollToContainerBottom(container, "auto");
    const after = readScrollMetrics(container);
    lastMetricsRef.current = after;
    if (!isFollowingRef.current) {
      isFollowingRef.current = true;
    }
    setIsFollowing((prev) => (prev ? prev : true));
  }, [events.length, logLines.length, isLive, getScrollContainer]);

  // Fetch persisted shell log
  useEffect(() => {
    let cancelled = false;
    pendingLogLineRef.current = "";
    setLogLines([]);
    setLogOffset(0);
    setLogError(null);

    if (!run.logRef) {
      setLogLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLogLoading(true);
    const firstLimit =
      typeof run.logBytes === "number" && run.logBytes > 0
        ? Math.min(Math.max(run.logBytes + 1024, 256_000), 2_000_000)
        : 256_000;

    const load = async () => {
      try {
        let offset = 0;
        let first = true;
        while (!cancelled) {
          const result = await heartbeatsApi.log(run.id, offset, first ? firstLimit : 256_000);
          if (cancelled) break;
          appendLogContent(result.content, result.nextOffset === undefined);
          const next = result.nextOffset ?? offset + result.content.length;
          setLogOffset(next);
          offset = next;
          first = false;
          if (result.nextOffset === undefined || isLive) break;
        }
      } catch (err) {
        if (!cancelled) {
          setLogError(err instanceof Error ? err.message : "Failed to load run log");
        }
      } finally {
        if (!cancelled) setLogLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [run.id, run.logRef, run.logBytes, isLive]);

  // Poll for live updates
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(async () => {
      const maxSeq = events.length > 0 ? Math.max(...events.map((e) => e.seq)) : 0;
      try {
        const newEvents = await heartbeatsApi.events(run.id, maxSeq, 100);
        if (newEvents.length > 0) {
          setEvents((prev) => [...prev, ...newEvents]);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [run.id, isLive, events]);

  // Poll shell log for running runs
  useEffect(() => {
    if (!isLive || !run.logRef) return;
    const interval = setInterval(async () => {
      try {
        const result = await heartbeatsApi.log(run.id, logOffset, 256_000);
        if (result.content) {
          appendLogContent(result.content, result.nextOffset === undefined);
        }
        if (result.nextOffset !== undefined) {
          setLogOffset(result.nextOffset);
        } else if (result.content.length > 0) {
          setLogOffset((prev) => prev + result.content.length);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [run.id, run.logRef, isLive, logOffset]);

  const adapterInvokePayload = useMemo(() => {
    const evt = events.find((e) => e.eventType === "adapter.invoke");
    return asRecord(evt?.payload ?? null);
  }, [events]);

  const adapter = useMemo(() => getUIAdapter(adapterType), [adapterType]);
  const transcript = useMemo(() => buildTranscript(logLines, adapter.parseStdoutLine), [logLines, adapter]);

  if (loading && logLoading) {
    return <p className="text-xs text-muted-foreground">Loading run logs...</p>;
  }

  if (events.length === 0 && logLines.length === 0 && !logError) {
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
    <div className="space-y-3">
      {adapterInvokePayload && (
        <div className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Invocation</div>
          {typeof adapterInvokePayload.adapterType === "string" && (
            <div className="text-xs"><span className="text-muted-foreground">Adapter: </span>{adapterInvokePayload.adapterType}</div>
          )}
          {typeof adapterInvokePayload.cwd === "string" && (
            <div className="text-xs"><span className="text-muted-foreground">Working dir: </span><span className="font-mono">{adapterInvokePayload.cwd}</span></div>
          )}
          {typeof adapterInvokePayload.command === "string" && (
            <div className="text-xs">
              <span className="text-muted-foreground">Command: </span>
              <span className="font-mono">
                {[
                  adapterInvokePayload.command,
                  ...(Array.isArray(adapterInvokePayload.commandArgs)
                    ? adapterInvokePayload.commandArgs.filter((v): v is string => typeof v === "string")
                    : []),
                ].join(" ")}
              </span>
            </div>
          )}
          {adapterInvokePayload.prompt !== undefined && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Prompt</div>
              <pre className="bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap">
                {typeof adapterInvokePayload.prompt === "string"
                  ? adapterInvokePayload.prompt
                  : JSON.stringify(adapterInvokePayload.prompt, null, 2)}
              </pre>
            </div>
          )}
          {adapterInvokePayload.context !== undefined && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Context</div>
              <pre className="bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(adapterInvokePayload.context, null, 2)}
              </pre>
            </div>
          )}
          {adapterInvokePayload.env !== undefined && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Environment</div>
              <pre className="bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                {formatEnvForDisplay(adapterInvokePayload.env)}
              </pre>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Transcript ({transcript.length})
        </span>
        <div className="flex items-center gap-2">
          {isLive && !isFollowing && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                const container = getScrollContainer();
                isFollowingRef.current = true;
                setIsFollowing(true);
                scrollToContainerBottom(container, "auto");
                lastMetricsRef.current = readScrollMetrics(container);
              }}
            >
              Jump to live
            </Button>
          )}
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
      </div>
      <div className="bg-neutral-950 rounded-lg p-3 font-mono text-xs space-y-0.5">
        {transcript.length === 0 && !run.logRef && (
          <div className="text-neutral-500">No persisted transcript for this run.</div>
        )}
        {transcript.map((entry, idx) => {
          const time = new Date(entry.ts).toLocaleTimeString("en-US", { hour12: false });
          const grid = "grid grid-cols-[auto_auto_1fr] gap-x-3 items-baseline";
          const tsCell = "text-neutral-600 select-none w-16";
          const lblCell = "w-20";
          const contentCell = "min-w-0 whitespace-pre-wrap break-words";
          const expandCell = "col-span-full md:col-start-3 md:col-span-1";

          if (entry.kind === "assistant") {
            return (
              <div key={`${entry.ts}-assistant-${idx}`} className={cn(grid, "py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-green-300")}>assistant</span>
                <span className={cn(contentCell, "text-green-100")}>{entry.text}</span>
              </div>
            );
          }

          if (entry.kind === "thinking") {
            return (
              <div key={`${entry.ts}-thinking-${idx}`} className={cn(grid, "py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-green-300/60")}>thinking</span>
                <span className={cn(contentCell, "text-green-100/60 italic")}>{entry.text}</span>
              </div>
            );
          }

          if (entry.kind === "user") {
            return (
              <div key={`${entry.ts}-user-${idx}`} className={cn(grid, "py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-neutral-400")}>user</span>
                <span className={cn(contentCell, "text-neutral-300")}>{entry.text}</span>
              </div>
            );
          }

          if (entry.kind === "tool_call") {
            return (
              <div key={`${entry.ts}-tool-${idx}`} className={cn(grid, "gap-y-1 py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-yellow-300")}>tool_call</span>
                <span className="text-yellow-100 min-w-0">{entry.name}</span>
                <pre className={cn(expandCell, "bg-neutral-900 rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap text-neutral-200")}>
                  {JSON.stringify(entry.input, null, 2)}
                </pre>
              </div>
            );
          }

          if (entry.kind === "tool_result") {
            return (
              <div key={`${entry.ts}-toolres-${idx}`} className={cn(grid, "gap-y-1 py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, entry.isError ? "text-red-300" : "text-purple-300")}>tool_result</span>
                {entry.isError ? <span className="text-red-400 min-w-0">error</span> : <span />}
                <pre className={cn(expandCell, "bg-neutral-900 rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap text-neutral-300 max-h-60 overflow-y-auto")}>
                  {(() => { try { return JSON.stringify(JSON.parse(entry.content), null, 2); } catch { return entry.content; } })()}
                </pre>
              </div>
            );
          }

          if (entry.kind === "init") {
            return (
              <div key={`${entry.ts}-init-${idx}`} className={grid}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-blue-300")}>init</span>
                <span className={cn(contentCell, "text-blue-100")}>model: {entry.model}{entry.sessionId ? `, session: ${entry.sessionId}` : ""}</span>
              </div>
            );
          }

          if (entry.kind === "result") {
            return (
              <div key={`${entry.ts}-result-${idx}`} className={cn(grid, "gap-y-1 py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-cyan-300")}>result</span>
                <span className={cn(contentCell, "text-cyan-100")}>
                  tokens in={formatTokens(entry.inputTokens)} out={formatTokens(entry.outputTokens)} cached={formatTokens(entry.cachedTokens)} cost=${entry.costUsd.toFixed(6)}
                </span>
                {(entry.subtype || entry.isError || entry.errors.length > 0) && (
                  <div className={cn(expandCell, "text-red-300 whitespace-pre-wrap break-words")}>
                    subtype={entry.subtype || "unknown"} is_error={entry.isError ? "true" : "false"}
                    {entry.errors.length > 0 ? ` errors=${entry.errors.join(" | ")}` : ""}
                  </div>
                )}
                {entry.text && (
                  <div className={cn(expandCell, "whitespace-pre-wrap break-words text-neutral-100")}>{entry.text}</div>
                )}
              </div>
            );
          }

          const rawText = entry.text;
          const label =
            entry.kind === "stderr" ? "stderr" :
            entry.kind === "system" ? "system" :
            "stdout";
          const color =
            entry.kind === "stderr" ? "text-red-300" :
            entry.kind === "system" ? "text-blue-300" :
            "text-neutral-500";
          return (
            <div key={`${entry.ts}-raw-${idx}`} className={grid}>
              <span className={tsCell}>{time}</span>
              <span className={cn(lblCell, color)}>{label}</span>
              <span className={cn(contentCell, color)}>{rawText}</span>
            </div>
          )
        })}
        {logError && <div className="text-red-300">{logError}</div>}
        <div ref={logEndRef} />
      </div>

      {(run.status === "failed" || run.status === "timed_out") && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 space-y-2">
          <div className="text-xs font-medium text-red-300">Failure details</div>
          {run.error && (
            <div className="text-xs text-red-200">
              <span className="text-red-300">Error: </span>
              {run.error}
            </div>
          )}
          {run.stderrExcerpt && run.stderrExcerpt.trim() && (
            <div>
              <div className="text-xs text-red-300 mb-1">stderr excerpt</div>
              <pre className="bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-100">
                {run.stderrExcerpt}
              </pre>
            </div>
          )}
          {run.resultJson && (
            <div>
              <div className="text-xs text-red-300 mb-1">adapter result JSON</div>
              <pre className="bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-100">
                {JSON.stringify(run.resultJson, null, 2)}
              </pre>
            </div>
          )}
          {run.stdoutExcerpt && run.stdoutExcerpt.trim() && !run.resultJson && (
            <div>
              <div className="text-xs text-red-300 mb-1">stdout excerpt</div>
              <pre className="bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-100">
                {run.stdoutExcerpt}
              </pre>
            </div>
          )}
        </div>
      )}

      {events.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Events ({events.length})</div>
          <div className="bg-neutral-950 rounded-lg p-3 font-mono text-xs space-y-0.5">
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
                  <span className={cn("shrink-0 w-14", evt.stream ? (streamColors[evt.stream] ?? "text-neutral-500") : "text-neutral-500")}>
                    {evt.stream ? `[${evt.stream}]` : ""}
                  </span>
                  <span className={cn("break-all", color)}>
                    {evt.message ?? (evt.payload ? JSON.stringify(evt.payload) : "")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Costs Tab ---- */

function CostsTab({
  runtimeState,
  runs,
}: {
  runtimeState?: AgentRuntimeState;
  runs: HeartbeatRun[];
}) {
  const runsWithCost = runs
    .filter((r) => {
      const u = r.usageJson as Record<string, unknown> | null;
      return u && (u.cost_usd || u.total_cost_usd || u.input_tokens);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
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
    <div className="space-y-6">
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
          <div className="border border-border divide-y divide-border">
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
          <div className="border border-border divide-y divide-border opacity-50">
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
