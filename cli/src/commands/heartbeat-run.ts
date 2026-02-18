import { setTimeout as delay } from "node:timers/promises";
import pc from "picocolors";
import type { Agent, HeartbeatRun, HeartbeatRunEvent, HeartbeatRunStatus } from "@paperclip/shared";
import type { PaperclipConfig } from "../config/schema.js";
import { readConfig } from "../config/store.js";

const HEARTBEAT_SOURCES = ["timer", "assignment", "on_demand", "automation"] as const;
const HEARTBEAT_TRIGGERS = ["manual", "ping", "callback", "system"] as const;
const TERMINAL_STATUSES = new Set<HeartbeatRunStatus>(["succeeded", "failed", "cancelled", "timed_out"]);
const POLL_INTERVAL_MS = 200;

type HeartbeatSource = (typeof HEARTBEAT_SOURCES)[number];
type HeartbeatTrigger = (typeof HEARTBEAT_TRIGGERS)[number];
type InvokedHeartbeat = HeartbeatRun | { status: "skipped" };
interface HeartbeatRunEventRecord extends HeartbeatRunEvent {
  type?: string | null;
}

interface HeartbeatRunOptions {
  config?: string;
  agentId: string;
  apiBase?: string;
  source: string;
  trigger: string;
  timeoutMs: string;
}

export async function heartbeatRun(opts: HeartbeatRunOptions): Promise<void> {
  const parsedTimeout = Number.parseInt(opts.timeoutMs, 10);
  const timeoutMs = Number.isFinite(parsedTimeout) ? parsedTimeout : 0;
  const source = HEARTBEAT_SOURCES.includes(opts.source as HeartbeatSource)
    ? (opts.source as HeartbeatSource)
    : "on_demand";
  const triggerDetail = HEARTBEAT_TRIGGERS.includes(opts.trigger as HeartbeatTrigger)
    ? (opts.trigger as HeartbeatTrigger)
    : "manual";

  const config = readConfig(opts.config);
  const apiBase = getApiBase(config, opts.apiBase);

  const agent = await requestJson<Agent>(`${apiBase}/api/agents/${opts.agentId}`, {
    method: "GET",
  });
  if (!agent || typeof agent !== "object" || !agent.id) {
    console.error(pc.red(`Agent not found: ${opts.agentId}`));
    return;
  }

  const invokeRes = await requestJson<InvokedHeartbeat>(
    `${apiBase}/api/agents/${opts.agentId}/wakeup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: source,
        triggerDetail: triggerDetail,
      }),
    },
  );
  if (!invokeRes) {
    console.error(pc.red("Failed to invoke heartbeat"));
    return;
  }
  if ((invokeRes as { status?: string }).status === "skipped") {
    console.log(pc.yellow("Heartbeat invocation was skipped"));
    return;
  }

  const run = invokeRes as HeartbeatRun;
  console.log(pc.cyan(`Invoked heartbeat run ${run.id} for agent ${agent.name} (${agent.id})`));

  const runId = run.id;
  let activeRunId: string | null = null;
  let lastEventSeq = 0;
  let logOffset = 0;

  const handleEvent = (event: HeartbeatRunEventRecord) => {
    const payload = normalizePayload(event.payload);
    if (event.runId !== runId) return;
    const eventType = typeof event.eventType === "string"
      ? event.eventType
      : typeof event.type === "string"
      ? event.type
      : "";

    if (eventType === "heartbeat.run.status") {
      const status = typeof payload.status === "string" ? payload.status : null;
      if (status) {
        console.log(pc.blue(`[status] ${status}`));
      }
    } else if (eventType === "heartbeat.run.log") {
      const stream = typeof payload.stream === "string" ? payload.stream : "system";
      const chunk = typeof payload.chunk === "string" ? payload.chunk : "";
      if (!chunk) return;
      if (stream === "stdout") {
        process.stdout.write(pc.green("[stdout] ") + chunk);
      } else if (stream === "stderr") {
        process.stdout.write(pc.red("[stderr] ") + chunk);
      } else {
        process.stdout.write(pc.yellow("[system] ") + chunk);
      }
    } else if (typeof event.message === "string") {
      console.log(pc.gray(`[event] ${eventType || "heartbeat.run.event"}: ${event.message}`));
    }

    lastEventSeq = Math.max(lastEventSeq, event.seq ?? 0);
  };

  activeRunId = runId;
  let finalStatus: string | null = null;
  let finalError: string | null = null;

  const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : null;
  if (!activeRunId) {
    console.error(pc.red("Failed to capture heartbeat run id"));
    return;
  }

  while (true) {
      const events = await requestJson<HeartbeatRunEvent[]>(
        `${apiBase}/api/heartbeat-runs/${activeRunId}/events?afterSeq=${lastEventSeq}&limit=100`,
        { method: "GET" },
      );
    for (const event of Array.isArray(events) ? (events as HeartbeatRunEventRecord[]) : []) {
      handleEvent(event);
    }

      const runList = (await requestJson<(HeartbeatRun | null)[]>(
        `${apiBase}/api/companies/${agent.companyId}/heartbeat-runs?agentId=${agent.id}`,
      )) || [];
      const currentRun = runList.find((r) => r && r.id === activeRunId) ?? null;

    if (!currentRun) {
      console.error(pc.red("Heartbeat run disappeared"));
      break;
    }

    const currentStatus = currentRun.status as HeartbeatRunStatus | undefined;
    if (currentStatus !== finalStatus && currentStatus) {
      finalStatus = currentStatus;
      console.log(pc.blue(`Status: ${currentStatus}`));
    }

    if (currentStatus && TERMINAL_STATUSES.has(currentStatus)) {
      finalStatus = currentRun.status;
      finalError = currentRun.error;
      break;
    }

    if (deadline && Date.now() >= deadline) {
      finalError = `CLI timed out after ${timeoutMs}ms`;
      finalStatus = "timed_out";
      console.error(pc.yellow(finalError));
      break;
    }

    const logResult = await requestJson<{ content: string; nextOffset?: number }>(
      `${apiBase}/api/heartbeat-runs/${activeRunId}/log?offset=${logOffset}&limitBytes=16384`,
      { method: "GET" },
      { ignoreNotFound: true },
    );
    if (logResult && logResult.content) {
      for (const chunk of logResult.content.split(/\r?\n/)) {
        if (!chunk) continue;
        const parsed = safeParseLogLine(chunk);
        if (!parsed) continue;
        if (parsed.stream === "stdout") {
          process.stdout.write(pc.green("[stdout] ") + parsed.chunk);
        } else if (parsed.stream === "stderr") {
          process.stdout.write(pc.red("[stderr] ") + parsed.chunk);
        } else {
          process.stdout.write(pc.yellow("[system] ") + parsed.chunk);
        }
      }
      if (typeof logResult.nextOffset === "number") {
        logOffset = logResult.nextOffset;
      }
    }

    await delay(POLL_INTERVAL_MS);
  }

  if (finalStatus) {
    const label = `Run ${activeRunId} completed with status ${finalStatus}`;
    if (finalStatus === "succeeded") {
      console.log(pc.green(label));
      return;
    }

    console.log(pc.red(label));
    if (finalError) {
      console.log(pc.red(`Error: ${finalError}`));
    }
    process.exitCode = 1;
  } else {
    process.exitCode = 1;
    console.log(pc.gray("Heartbeat stream ended without terminal status"));
  }
}

function normalizePayload(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
}

function safeParseLogLine(line: string): { stream: "stdout" | "stderr" | "system"; chunk: string } | null {
  try {
    const parsed = JSON.parse(line) as { stream?: unknown; chunk?: unknown };
    const stream =
      parsed.stream === "stdout" || parsed.stream === "stderr" || parsed.stream === "system"
        ? parsed.stream
        : "system";
    const chunk = typeof parsed.chunk === "string" ? parsed.chunk : "";

    if (!chunk) return null;
    return { stream, chunk };
  } catch {
    return null;
  }
}

function getApiBase(config: PaperclipConfig | null, apiBaseOverride?: string): string {
  if (apiBaseOverride?.trim()) return apiBaseOverride.trim();
  const envBase = process.env.PAPERCLIP_API_URL?.trim();
  if (envBase) return envBase;
  const envHost = process.env.PAPERCLIP_SERVER_HOST?.trim() || "localhost";
  const envPort = Number(process.env.PAPERCLIP_SERVER_PORT || config?.server?.port || 3100);
  return `http://${envHost}:${Number.isFinite(envPort) && envPort > 0 ? envPort : 3100}`;
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  opts?: { ignoreNotFound?: boolean },
): Promise<T | null> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      accept: "application/json",
    },
  });

  if (!res.ok) {
    if (opts?.ignoreNotFound && res.status === 404) {
      return null;
    }
    const text = await safeReadText(res);
    console.error(pc.red(`Request failed (${res.status}): ${text || res.statusText}`));
    return null;
  }

  return (await res.json()) as T;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return "";
    const trimmed = text.trim();
    if (!trimmed) return "";
    if (trimmed[0] === "{" || trimmed[0] === "[") return trimmed;
    return trimmed;
  } catch (_err) {
    return "";
  }
}
