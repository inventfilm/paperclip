import { spawn, type ChildProcess } from "node:child_process";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import { agents, heartbeatRuns } from "@paperclip/db";
import { conflict, notFound } from "../errors.js";
import { logger } from "../middleware/logger.js";

interface RunningProcess {
  child: ChildProcess;
  graceSec: number;
}

const runningProcesses = new Map<string, RunningProcess>();

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function heartbeatService(db: Db) {
  async function getAgent(agentId: string) {
    return db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .then((rows) => rows[0] ?? null);
  }

  async function setRunStatus(
    runId: string,
    status: string,
    patch?: Partial<typeof heartbeatRuns.$inferInsert>,
  ) {
    return db
      .update(heartbeatRuns)
      .set({ status, ...patch, updatedAt: new Date() })
      .where(eq(heartbeatRuns.id, runId))
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  async function finalizeAgentStatus(agentId: string, ok: boolean) {
    const existing = await getAgent(agentId);
    if (!existing) return;

    if (existing.status === "paused" || existing.status === "terminated") {
      return;
    }

    await db
      .update(agents)
      .set({
        status: ok ? "idle" : "error",
        lastHeartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));
  }

  async function executeHttpRun(runId: string, agentId: string, config: Record<string, unknown>, context: Record<string, unknown>) {
    const url = asString(config.url, "");
    if (!url) throw new Error("HTTP adapter missing url");

    const method = asString(config.method, "POST");
    const timeoutMs = asNumber(config.timeoutMs, 15000);
    const headers = parseObject(config.headers) as Record<string, string>;
    const payloadTemplate = parseObject(config.payloadTemplate);
    const body = { ...payloadTemplate, agentId, runId, context };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP invoke failed with status ${res.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async function executeProcessRun(
    runId: string,
    _agentId: string,
    config: Record<string, unknown>,
  ) {
    const command = asString(config.command, "");
    if (!command) throw new Error("Process adapter missing command");

    const args = asStringArray(config.args);
    const cwd = typeof config.cwd === "string" ? config.cwd : process.cwd();
    const envConfig = parseObject(config.env);
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(envConfig)) {
      if (typeof v === "string") env[k] = v;
    }

    const timeoutSec = asNumber(config.timeoutSec, 900);
    const graceSec = asNumber(config.graceSec, 15);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
      });

      runningProcesses.set(runId, { child, graceSec });

      const timeout = setTimeout(async () => {
        child.kill("SIGTERM");
        await setRunStatus(runId, "timed_out", {
          error: `Timed out after ${timeoutSec}s`,
          finishedAt: new Date(),
        });
        runningProcesses.delete(runId);
        resolve();
      }, timeoutSec * 1000);

      child.stdout?.on("data", (chunk) => {
        logger.info({ runId, output: String(chunk) }, "agent process stdout");
      });
      child.stderr?.on("data", (chunk) => {
        logger.warn({ runId, output: String(chunk) }, "agent process stderr");
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        runningProcesses.delete(runId);
        reject(err);
      });

      child.on("exit", (code, signal) => {
        clearTimeout(timeout);
        runningProcesses.delete(runId);

        if (signal) {
          resolve();
          return;
        }

        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Process exited with code ${code ?? -1}`));
      });
    });
  }

  async function executeRun(runId: string) {
    const run = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, runId))
      .then((rows) => rows[0] ?? null);

    if (!run) {
      return;
    }

    const agent = await getAgent(run.agentId);
    if (!agent) {
      await setRunStatus(runId, "failed", {
        error: "Agent not found",
        finishedAt: new Date(),
      });
      return;
    }

    await setRunStatus(run.id, "running", { startedAt: new Date() });
    await db
      .update(agents)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(agents.id, agent.id));

    try {
      const config = parseObject(agent.adapterConfig);
      const context = (run.contextSnapshot ?? {}) as Record<string, unknown>;

      if (agent.adapterType === "http") {
        await executeHttpRun(run.id, agent.id, config, context);
      } else {
        await executeProcessRun(run.id, agent.id, config);
      }

      const latestRun = await db
        .select()
        .from(heartbeatRuns)
        .where(eq(heartbeatRuns.id, run.id))
        .then((rows) => rows[0] ?? null);

      if (latestRun?.status === "timed_out" || latestRun?.status === "cancelled") {
        await finalizeAgentStatus(agent.id, false);
        return;
      }

      await setRunStatus(run.id, "succeeded", { finishedAt: new Date(), error: null });
      await finalizeAgentStatus(agent.id, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown adapter failure";
      await setRunStatus(run.id, "failed", {
        error: message,
        finishedAt: new Date(),
      });
      await finalizeAgentStatus(agent.id, false);
    }
  }

  return {
    list: (companyId: string, agentId?: string) => {
      if (!agentId) {
        return db.select().from(heartbeatRuns).where(eq(heartbeatRuns.companyId, companyId));
      }

      return db
        .select()
        .from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.companyId, companyId), eq(heartbeatRuns.agentId, agentId)));
    },

    invoke: async (
      agentId: string,
      invocationSource: "scheduler" | "manual" | "callback" = "manual",
      contextSnapshot: Record<string, unknown> = {},
    ) => {
      const agent = await getAgent(agentId);
      if (!agent) throw notFound("Agent not found");

      if (agent.status === "paused" || agent.status === "terminated") {
        throw conflict("Agent is not invokable in its current state", { status: agent.status });
      }

      const activeRun = await db
        .select({ id: heartbeatRuns.id })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.agentId, agentId),
            inArray(heartbeatRuns.status, ["queued", "running"]),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (activeRun) {
        throw conflict("Agent already has an active heartbeat run", { runId: activeRun.id });
      }

      const run = await db
        .insert(heartbeatRuns)
        .values({
          companyId: agent.companyId,
          agentId,
          invocationSource,
          status: "queued",
          contextSnapshot,
        })
        .returning()
        .then((rows) => rows[0]);

      void executeRun(run.id).catch((err) => {
        logger.error({ err, runId: run.id }, "heartbeat execution failed");
      });

      return run;
    },

    cancelRun: async (runId: string) => {
      const run = await db
        .select()
        .from(heartbeatRuns)
        .where(eq(heartbeatRuns.id, runId))
        .then((rows) => rows[0] ?? null);

      if (!run) throw notFound("Heartbeat run not found");
      if (run.status !== "running" && run.status !== "queued") return run;

      const running = runningProcesses.get(run.id);
      if (running) {
        running.child.kill("SIGTERM");
        const graceMs = Math.max(1, running.graceSec) * 1000;
        setTimeout(() => {
          if (!running.child.killed) {
            running.child.kill("SIGKILL");
          }
        }, graceMs);
      }

      const cancelled = await setRunStatus(run.id, "cancelled", {
        finishedAt: new Date(),
        error: "Cancelled by control plane",
      });

      runningProcesses.delete(run.id);
      return cancelled;
    },

    cancelActiveForAgent: async (agentId: string) => {
      const runs = await db
        .select()
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.agentId, agentId),
            inArray(heartbeatRuns.status, ["queued", "running"]),
          ),
        );

      for (const run of runs) {
        await db
          .update(heartbeatRuns)
          .set({
            status: "cancelled",
            finishedAt: new Date(),
            error: "Cancelled due to agent pause",
            updatedAt: new Date(),
          })
          .where(eq(heartbeatRuns.id, run.id));

        const running = runningProcesses.get(run.id);
        if (running) {
          running.child.kill("SIGTERM");
          runningProcesses.delete(run.id);
        }
      }

      return runs.length;
    },
  };
}
