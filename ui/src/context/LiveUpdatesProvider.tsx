import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Agent, Issue, LiveEvent } from "@paperclip/shared";
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

function resolveAgentName(
  queryClient: QueryClient,
  companyId: string,
  agentId: string,
): string | null {
  const agents = queryClient.getQueryData<Agent[]>(queryKeys.agents.list(companyId));
  if (!agents) return null;
  const agent = agents.find((a) => a.id === agentId);
  return agent?.name ?? null;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveActorLabel(
  queryClient: QueryClient,
  companyId: string,
  actorType: string | null,
  actorId: string | null,
): string {
  if (actorType === "agent" && actorId) {
    return resolveAgentName(queryClient, companyId, actorId) ?? `Agent ${shortId(actorId)}`;
  }
  if (actorType === "system") return "System";
  if (actorType === "user" && actorId) {
    if (looksLikeUuid(actorId)) return `User ${shortId(actorId)}`;
    return titleCase(actorId.replace(/[_-]+/g, " "));
  }
  return "Someone";
}

interface IssueToastContext {
  ref: string;
  title: string | null;
  label: string;
  href: string;
}

function resolveIssueToastContext(
  queryClient: QueryClient,
  companyId: string,
  issueId: string,
  details: Record<string, unknown> | null,
): IssueToastContext {
  const detailIssue = queryClient.getQueryData<Issue>(queryKeys.issues.detail(issueId));
  const listIssue = queryClient
    .getQueryData<Issue[]>(queryKeys.issues.list(companyId))
    ?.find((issue) => issue.id === issueId);
  const cachedIssue = detailIssue ?? listIssue ?? null;
  const ref =
    readString(details?.identifier) ??
    readString(details?.issueIdentifier) ??
    cachedIssue?.identifier ??
    `Issue ${shortId(issueId)}`;
  const title =
    readString(details?.title) ??
    readString(details?.issueTitle) ??
    cachedIssue?.title ??
    null;
  return {
    ref,
    title,
    label: title ? `${ref} - ${truncate(title, 72)}` : ref,
    href: `/issues/${issueId}`,
  };
}

const ISSUE_TOAST_ACTIONS = new Set(["issue.created", "issue.updated", "issue.comment_added"]);
const AGENT_TOAST_STATUSES = new Set(["running", "idle", "error"]);
const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "timed_out", "cancelled"]);

function describeIssueUpdate(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  const changes: string[] = [];
  if (typeof details.status === "string") changes.push(`status -> ${details.status.replace(/_/g, " ")}`);
  if (typeof details.priority === "string") changes.push(`priority -> ${details.priority}`);
  if (typeof details.assigneeAgentId === "string") changes.push("reassigned");
  else if (details.assigneeAgentId === null) changes.push("unassigned");
  if (details.reopened === true) {
    const from = readString(details.reopenedFrom);
    changes.push(from ? `reopened from ${from.replace(/_/g, " ")}` : "reopened");
  }
  if (typeof details.title === "string") changes.push("title changed");
  if (typeof details.description === "string") changes.push("description changed");
  if (changes.length > 0) return changes.join(", ");
  return null;
}

function buildActivityToast(
  queryClient: QueryClient,
  companyId: string,
  payload: Record<string, unknown>,
): ToastInput | null {
  const entityType = readString(payload.entityType);
  const entityId = readString(payload.entityId);
  const action = readString(payload.action);
  const details = readRecord(payload.details);
  const actorId = readString(payload.actorId);
  const actorType = readString(payload.actorType);

  if (entityType !== "issue" || !entityId || !action || !ISSUE_TOAST_ACTIONS.has(action)) {
    return null;
  }

  const issue = resolveIssueToastContext(queryClient, companyId, entityId, details);
  const actor = resolveActorLabel(queryClient, companyId, actorType, actorId);

  if (action === "issue.created") {
    return {
      title: `${actor} created ${issue.ref}`,
      body: issue.title ? truncate(issue.title, 96) : undefined,
      tone: "success",
      action: { label: `View ${issue.ref}`, href: issue.href },
      dedupeKey: `activity:${action}:${entityId}`,
    };
  }

  if (action === "issue.updated") {
    const changeDesc = describeIssueUpdate(details);
    const body = changeDesc
      ? issue.title
        ? `${truncate(issue.title, 64)} - ${changeDesc}`
        : changeDesc
      : issue.title
        ? truncate(issue.title, 96)
        : issue.label;
    return {
      title: `${actor} updated ${issue.ref}`,
      body: truncate(body, 100),
      tone: "info",
      action: { label: `View ${issue.ref}`, href: issue.href },
      dedupeKey: `activity:${action}:${entityId}`,
    };
  }

  const commentId = readString(details?.commentId);
  return {
    title: `${actor} posted a comment on ${issue.ref}`,
    body: issue.title ? truncate(issue.title, 96) : undefined,
    tone: "info",
    action: { label: `View ${issue.ref}`, href: issue.href },
    dedupeKey: `activity:${action}:${entityId}:${commentId ?? "na"}`,
  };
}

function buildAgentStatusToast(
  payload: Record<string, unknown>,
  nameOf: (id: string) => string | null,
): ToastInput | null {
  const agentId = readString(payload.agentId);
  const status = readString(payload.status);
  if (!agentId || !status || !AGENT_TOAST_STATUSES.has(status)) return null;

  const tone = status === "error" ? "error" : status === "idle" ? "success" : "info";
  const name = nameOf(agentId) ?? `Agent ${shortId(agentId)}`;
  const title =
    status === "running"
      ? `${name} started`
      : status === "idle"
        ? `${name} is idle`
        : `${name} errored`;

  return {
    title,
    tone,
    action: { label: "View agent", href: `/agents/${agentId}` },
    dedupeKey: `agent-status:${agentId}:${status}`,
  };
}

function buildRunStatusToast(
  payload: Record<string, unknown>,
  nameOf: (id: string) => string | null,
): ToastInput | null {
  const runId = readString(payload.runId);
  const agentId = readString(payload.agentId);
  const status = readString(payload.status);
  if (!runId || !agentId || !status || !TERMINAL_RUN_STATUSES.has(status)) return null;

  const error = readString(payload.error);
  const name = nameOf(agentId) ?? `Agent ${shortId(agentId)}`;
  const tone = status === "succeeded" ? "success" : status === "cancelled" ? "warn" : "error";
  const title =
    status === "succeeded"
      ? `${name} run succeeded`
      : status === "failed"
        ? `${name} run failed`
        : status === "timed_out"
          ? `${name} run timed out`
          : `${name} run cancelled`;

  return {
    title,
    body: error ? truncate(error, 100) : undefined,
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
  queryClient: QueryClient,
  expectedCompanyId: string,
  event: LiveEvent,
  pushToast: (toast: ToastInput) => string | null,
  gate: ToastGate,
) {
  if (event.companyId !== expectedCompanyId) return;

  const nameOf = (id: string) => resolveAgentName(queryClient, expectedCompanyId, id);
  const payload = event.payload ?? {};
  if (event.type === "heartbeat.run.log") {
    return;
  }

  if (event.type === "heartbeat.run.queued" || event.type === "heartbeat.run.status") {
    invalidateHeartbeatQueries(queryClient, expectedCompanyId, payload);
    if (event.type === "heartbeat.run.status") {
      const toast = buildRunStatusToast(payload, nameOf);
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
    const toast = buildAgentStatusToast(payload, nameOf);
    if (toast) gatedPushToast(gate, pushToast, "agent-status", toast);
    return;
  }

  if (event.type === "activity.logged") {
    invalidateActivityQueries(queryClient, expectedCompanyId, payload);
    const action = readString(payload.action);
    const toast = buildActivityToast(queryClient, expectedCompanyId, payload);
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
