import { resolve } from "node:path";
import pc from "picocolors";
import { createDb, createPgliteDb } from "@paperclip/db";
import { heartbeatService, subscribeCompanyLiveEvents } from "../../server/src/services/index.js";
import { agents } from "@paperclip/db";
import { eq } from "drizzle-orm";
import type { PaperclipConfig } from "../config/schema.js";
import { readConfig } from "../config/store.js";
import type { LiveEvent } from "@paperclip/shared";

const HEARTBEAT_SOURCES = ["timer", "assignment", "on_demand", "automation"] as const;
const HEARTBEAT_TRIGGERS = ["manual", "ping", "callback", "system"] as const;
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled", "timed_out"]);
const POLL_INTERVAL_MS = 200;

type HeartbeatSource = (typeof HEARTBEAT_SOURCES)[number];
type HeartbeatTrigger = (typeof HEARTBEAT_TRIGGERS)[number];

interface HeartbeatRunOptions {
  config?: string;
  agentId: string;
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
  const db = await createHeartbeatDb(config);

  const [agent] = await db.select().from(agents).where(eq(agents.id, opts.agentId));
  if (!agent) {
    console.error(pc.red(`Agent not found: ${opts.agentId}`));
    return;
  }

  const heartbeat = heartbeatService(db);
  let activeRunId: string | null = null;
  const unsubscribe = subscribeCompanyLiveEvents(agent.companyId, (event: LiveEvent) => {
    const payload = normalizePayload(event.payload);
    const payloadRunId = typeof payload.runId === "string" ? payload.runId : null;
    const payloadAgentId = typeof payload.agentId === "string" ? payload.agentId : null;
    if (!payloadRunId || (payloadAgentId && payloadAgentId !== agent.id)) return;

    if (activeRunId === null) {
      activeRunId = payloadRunId;
    } else if (payloadRunId !== activeRunId) {
      return;
    }

    if (event.type === "heartbeat.run.status") {
      const status = typeof payload.status === "string" ? payload.status : null;
      if (status) {
        console.log(pc.blue(`[status] ${status}`));
      }
    } else if (event.type === "heartbeat.run.log") {
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
    } else if (event.type === "heartbeat.run.event") {
      if (typeof payload.message === "string") {
        console.log(pc.gray(`[event] ${payload.eventType ?? "heartbeat.run.event"}: ${payload.message}`));
      }
    }
  });

  const run = await heartbeat.invoke(opts.agentId, source, {}, triggerDetail, {
    actorType: "user",
    actorId: "paperclip cli",
  });

  if (!run) {
    console.error(pc.red("Heartbeat was not queued."));
    return;
  }

  console.log(pc.cyan(`Invoked heartbeat run ${run.id} for agent ${agent.name} (${agent.id})`));

  activeRunId = run.id;
  let finalStatus: string | null = null;
  let finalError: string | null = null;

  const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : null;
  if (!activeRunId) {
    console.error(pc.red("Failed to capture heartbeat run id"));
    return;
  }

  try {
    while (true) {
      const currentRun = await heartbeat.getRun(activeRunId);
      if (!currentRun) {
        console.error(pc.red("Heartbeat run disappeared"));
        break;
      }

      if (currentRun.status !== finalStatus && currentRun.status) {
        finalStatus = currentRun.status;
        const statusText = `Status: ${currentRun.status}`;
        console.log(pc.blue(statusText));
      }

      if (TERMINAL_STATUSES.has(currentRun.status)) {
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

      await sleep(POLL_INTERVAL_MS);
    }
  } finally {
    unsubscribe();
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

async function createHeartbeatDb(config: PaperclipConfig | null) {
  if (process.env.DATABASE_URL) {
    return createDb(process.env.DATABASE_URL);
  }

  if (!config || config.database.mode === "pglite") {
    return createPgliteDb(resolve(process.cwd(), config?.database.pgliteDataDir ?? "./data/pglite"));
  }

  if (!config.database.connectionString) {
    throw new Error("Postgres mode is configured but connectionString is missing");
  }

  return createDb(config.database.connectionString);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
