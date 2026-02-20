import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LiveEvent } from "@paperclip/shared";
import { useCompany } from "./CompanyContext";
import type { ToastInput } from "./ToastContext";
import { useToast } from "./ToastContext";
import { queryKeys } from "../lib/queryKeys";

const TOAST_COOLDOWN_WINDOW_MS = 10_000;
const TOAST_COOLDOWN_MAX = 3;
const RECONNECT_SUPPRESS_MS = 2000;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function shortId(value: string) {
  return value.slice(0, 8);
}

const ISSUE_TOAST_ACTIONS = new Set(["issue.created", "issue.updated", "issue.comment_added"]);
const AGENT_TOAST_STATUSES = new Set(["running", "idle", "error"]);
const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "timed_out", "cancelled"]);

function buildActivityToast(payload: Record<string, unknown>): ToastInput | null {
  const entityType = readString(payload.entityType);
  const entityId = readString(payload.entityId);
  const action = readString(payload.action);
  const details = readRecord(payload.details);

  if (entityType !== "issue" || !entityId || !action || !ISSUE_TOAST_ACTIONS.has(action)) {
    return null;
  }

  const issueHref = `/issues/${entityId}`;
  const issueLabel = details?.title && typeof details.title === "string"
    ? details.title
    : `Issue ${shortId(entityId)}`;

  if (action === "issue.created") {
    return {
      title: "Issue created",
      body: issueLabel,
      tone: "success",
      action: { label: "Open issue", href: issueHref },
      dedupeKey: `activity:${action}:${entityId}`,
    };
  }

  if (action === "issue.updated") {
    return {
      title: "Issue updated",
      body: issueLabel,
      tone: "info",
      action: { label: "Open issue", href: issueHref },
      dedupeKey: `activity:${action}:${entityId}`,
    };
  }

  const commentId = readString(details?.commentId);
  return {
    title: "Issue comment added",
    body: issueLabel,
    tone: "info",
    action: { label: "Open issue", href: issueHref },
    dedupeKey: `activity:${action}:${entityId}:${commentId ?? "na"}`,
  };
}

function buildAgentStatusToast(payload: Record<string, unknown>): ToastInput | null {
  const agentId = readString(payload.agentId);
  const status = readString(payload.status);
  if (!agentId || !status || !AGENT_TOAST_STATUSES.has(status)) return null;

  const tone = status === "error" ? "error" : status === "idle" ? "success" : "info";
  const title =
    status === "running"
      ? "Agent started"
      : status === "idle"
        ? "Agent is idle"
        : "Agent error";

  return {
    title,
    body: `Agent ${shortId(agentId)}`,
    tone,
    action: { label: "View agent", href: `/agents/${agentId}` },
    dedupeKey: `agent-status:${agentId}:${status}`,
  };
}

function buildRunStatusToast(payload: Record<string, unknown>): ToastInput | null {
  const runId = readString(payload.runId);
  const agentId = readString(payload.agentId);
  const status = readString(payload.status);
  if (!runId || !agentId || !status || !TERMINAL_RUN_STATUSES.has(status)) return null;

  const error = readString(payload.error);
  const tone = status === "succeeded" ? "success" : status === "cancelled" ? "warn" : "error";
  const title =
    status === "succeeded"
      ? "Run succeeded"
      : status === "failed"
        ? "Run failed"
        : status === "timed_out"
          ? "Run timed out"
          : "Run cancelled";

  return {
    title,
    body: error ?? `Agent ${shortId(agentId)} · Run ${shortId(runId)}`,
    tone,
    ttlMs: status === "succeeded" ? 5000 : 7000,
    action: { label: "View run", href: `/agents/${agentId}/runs/${runId}` },
    dedupeKey: `run-status:${runId}:${status}`,
  };
}

function invalidateHeartbeatQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  companyId: string,
  payload: Record<string, unknown>,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.liveRuns(companyId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(companyId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.costs(companyId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(companyId) });

  const agentId = readString(payload.agentId);
  if (agentId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId, agentId) });
  }
}

function invalidateActivityQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  companyId: string,
  payload: Record<string, unknown>,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.activity(companyId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(companyId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(companyId) });

  const entityType = readString(payload.entityType);
  const entityId = readString(payload.entityId);

  if (entityType === "issue") {
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId) });
    if (entityId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(entityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(entityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.activity(entityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.runs(entityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.liveRuns(entityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.activeRun(entityId) });
    }
    return;
  }

  if (entityType === "agent") {
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.org(companyId) });
    if (entityId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(entityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId, entityId) });
    }
    return;
  }

  if (entityType === "project") {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(companyId) });
    if (entityId) queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(entityId) });
    return;
  }

  if (entityType === "goal") {
    queryClient.invalidateQueries({ queryKey: queryKeys.goals.list(companyId) });
    if (entityId) queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(entityId) });
    return;
  }

  if (entityType === "approval") {
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(companyId) });
    return;
  }

  if (entityType === "cost_event") {
    queryClient.invalidateQueries({ queryKey: queryKeys.costs(companyId) });
    return;
  }

  if (entityType === "company") {
    queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
  }
}

interface ToastGate {
  cooldownHits: Map<string, number[]>;
  suppressUntil: number;
}

function shouldSuppressToast(gate: ToastGate, category: string): boolean {
  const now = Date.now();
  if (now < gate.suppressUntil) return true;

  const hits = gate.cooldownHits.get(category);
  if (!hits) return false;

  const recent = hits.filter((t) => now - t < TOAST_COOLDOWN_WINDOW_MS);
  gate.cooldownHits.set(category, recent);
  return recent.length >= TOAST_COOLDOWN_MAX;
}

function recordToastHit(gate: ToastGate, category: string) {
  const now = Date.now();
  const hits = gate.cooldownHits.get(category) ?? [];
  hits.push(now);
  gate.cooldownHits.set(category, hits);
}

function gatedPushToast(
  gate: ToastGate,
  pushToast: (toast: ToastInput) => string | null,
  category: string,
  toast: ToastInput,
) {
  if (shouldSuppressToast(gate, category)) return;
  const id = pushToast(toast);
  if (id !== null) recordToastHit(gate, category);
}

function handleLiveEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  expectedCompanyId: string,
  event: LiveEvent,
  pushToast: (toast: ToastInput) => string | null,
  gate: ToastGate,
) {
  if (event.companyId !== expectedCompanyId) return;

  const payload = event.payload ?? {};
  if (event.type === "heartbeat.run.log") {
    return;
  }

  if (event.type === "heartbeat.run.queued" || event.type === "heartbeat.run.status") {
    invalidateHeartbeatQueries(queryClient, expectedCompanyId, payload);
    if (event.type === "heartbeat.run.status") {
      const toast = buildRunStatusToast(payload);
      if (toast) gatedPushToast(gate, pushToast, "run-status", toast);
    }
    return;
  }

  if (event.type === "heartbeat.run.event") {
    return;
  }

  if (event.type === "agent.status") {
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(expectedCompanyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(expectedCompanyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.org(expectedCompanyId) });
    const agentId = readString(payload.agentId);
    if (agentId) queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId) });
    const toast = buildAgentStatusToast(payload);
    if (toast) gatedPushToast(gate, pushToast, "agent-status", toast);
    return;
  }

  if (event.type === "activity.logged") {
    invalidateActivityQueries(queryClient, expectedCompanyId, payload);
    const action = readString(payload.action);
    const toast = buildActivityToast(payload);
    if (toast) gatedPushToast(gate, pushToast, `activity:${action ?? "unknown"}`, toast);
  }
}

export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const gateRef = useRef<ToastGate>({ cooldownHits: new Map(), suppressUntil: 0 });

  useEffect(() => {
    if (!selectedCompanyId) return;

    let closed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed) return;
      reconnectAttempt += 1;
      const delayMs = Math.min(15000, 1000 * 2 ** Math.min(reconnectAttempt - 1, 4));
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/api/companies/${encodeURIComponent(selectedCompanyId)}/events/ws`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        if (reconnectAttempt > 0) {
          gateRef.current.suppressUntil = Date.now() + RECONNECT_SUPPRESS_MS;
        }
        reconnectAttempt = 0;
      };

      socket.onmessage = (message) => {
        const raw = typeof message.data === "string" ? message.data : "";
        if (!raw) return;

        try {
          const parsed = JSON.parse(raw) as LiveEvent;
          handleLiveEvent(queryClient, selectedCompanyId, parsed, pushToast, gateRef.current);
        } catch {
          // Ignore non-JSON payloads.
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (closed) return;
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      closed = true;
      clearReconnect();
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close(1000, "provider_unmount");
      }
    };
  }, [queryClient, selectedCompanyId, pushToast]);

  return <>{children}</>;
}
