import { existsSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  createDb,
  ensurePostgresDatabase,
  inspectMigrations,
  applyPendingMigrations,
  reconcilePendingMigrationHistory,
} from "@paperclip/db";
import detectPort from "detect-port";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { logger } from "./middleware/logger.js";
import { setupLiveEventsWebSocketServer } from "./realtime/live-events-ws.js";
import { heartbeatService } from "./services/index.js";
import { printStartupBanner } from "./startup-banner.js";

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
}) => EmbeddedPostgresInstance;

const config = loadConfig();

type MigrationSummary =
  | "skipped"
  | "already applied"
  | "applied (empty database)"
  | "applied (pending migrations)"
  | "pending migrations skipped";

function formatPendingMigrationSummary(migrations: string[]): string {
  if (migrations.length === 0) return "none";
  return migrations.length > 3
    ? `${migrations.slice(0, 3).join(", ")} (+${migrations.length - 3} more)`
    : migrations.join(", ");
}

async function promptApplyMigrations(migrations: string[]): Promise<boolean> {
  if (process.env.PAPERCLIP_MIGRATION_PROMPT === "never") return false;
  if (!stdin.isTTY || !stdout.isTTY) return true;
  if (process.env.PAPERCLIP_MIGRATION_AUTO_APPLY === "true") return true;

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await prompt.question(
      `Apply pending migrations (${formatPendingMigrationSummary(migrations)}) now? (y/N): `,
    )).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    prompt.close();
  }
}

async function ensureMigrations(connectionString: string, label: string): Promise<MigrationSummary> {
  let state = await inspectMigrations(connectionString);
  if (state.status === "needsMigrations" && state.reason === "pending-migrations") {
    const repair = await reconcilePendingMigrationHistory(connectionString);
    if (repair.repairedMigrations.length > 0) {
      logger.warn(
        { repairedMigrations: repair.repairedMigrations },
        `${label} had drifted migration history; repaired migration journal entries from existing schema state.`,
      );
      state = await inspectMigrations(connectionString);
      if (state.status === "upToDate") return "already applied";
    }
  }
  if (state.status === "upToDate") return "already applied";
  if (state.status === "needsMigrations" && state.reason === "no-migration-journal-non-empty-db") {
    logger.warn(
      { tableCount: state.tableCount },
      `${label} has existing tables but no migration journal. Run migrations manually to sync schema.`,
    );
    const apply = await promptApplyMigrations(state.pendingMigrations);
    if (!apply) {
      logger.warn(
        { pendingMigrations: state.pendingMigrations },
        `${label} has pending migrations; continuing without applying. Run pnpm db:migrate to apply before startup.`,
      );
      return "pending migrations skipped";
    }

    logger.info({ pendingMigrations: state.pendingMigrations }, `Applying ${state.pendingMigrations.length} pending migrations for ${label}`);
    await applyPendingMigrations(connectionString);
    return "applied (pending migrations)";
  }

  const apply = await promptApplyMigrations(state.pendingMigrations);
  if (!apply) {
    logger.warn(
      { pendingMigrations: state.pendingMigrations },
      `${label} has pending migrations; continuing without applying. Run pnpm db:migrate to apply before startup.`,
    );
    return "pending migrations skipped";
  }

  logger.info({ pendingMigrations: state.pendingMigrations }, `Applying ${state.pendingMigrations.length} pending migrations for ${label}`);
  await applyPendingMigrations(connectionString);
  return "applied (pending migrations)";
}

let db;
let embeddedPostgres: EmbeddedPostgresInstance | null = null;
let embeddedPostgresStartedByThisProcess = false;
let migrationSummary: MigrationSummary = "skipped";
let startupDbInfo:
  | { mode: "external-postgres"; connectionString: string }
  | { mode: "embedded-postgres"; dataDir: string; port: number };
if (config.databaseUrl) {
  migrationSummary = await ensureMigrations(config.databaseUrl, "PostgreSQL");

  db = createDb(config.databaseUrl);
  logger.info("Using external PostgreSQL via DATABASE_URL/config");
  startupDbInfo = { mode: "external-postgres", connectionString: config.databaseUrl };
} else {
  const moduleName = "embedded-postgres";
  let EmbeddedPostgres: EmbeddedPostgresCtor;
  try {
    const mod = await import(moduleName);
    EmbeddedPostgres = mod.default as EmbeddedPostgresCtor;
  } catch {
    throw new Error(
      "Embedded PostgreSQL mode requires optional dependency `embedded-postgres`. Install optional dependencies or set DATABASE_URL for external Postgres.",
    );
  }

  const dataDir = resolve(config.embeddedPostgresDataDir);
  const port = config.embeddedPostgresPort;

  if (config.databaseMode === "postgres") {
    logger.warn("Database mode is postgres but no connection string was set; falling back to embedded PostgreSQL");
  }

  logger.info(`No DATABASE_URL set — using embedded PostgreSQL (${dataDir}) on port ${port}`);
  embeddedPostgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "paperclip",
    password: "paperclip",
    port,
    persistent: true,
  });
  const clusterVersionFile = resolve(dataDir, "PG_VERSION");
  if (!existsSync(clusterVersionFile)) {
    await embeddedPostgres.initialise();
  } else {
    logger.info(`Embedded PostgreSQL cluster already exists (${clusterVersionFile}); skipping init`);
  }

  const postmasterPidFile = resolve(dataDir, "postmaster.pid");
  const isPidRunning = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  const getRunningPid = (): number | null => {
    if (!existsSync(postmasterPidFile)) return null;
    try {
      const pidLine = readFileSync(postmasterPidFile, "utf8").split("\n")[0]?.trim();
      const pid = Number(pidLine);
      if (!Number.isInteger(pid) || pid <= 0) return null;
      if (!isPidRunning(pid)) return null;
      return pid;
    } catch {
      return null;
    }
  };

  const runningPid = getRunningPid();
  if (runningPid) {
    logger.warn({ pid: runningPid }, "Embedded PostgreSQL already running; reusing existing process");
  } else {
    if (existsSync(postmasterPidFile)) {
      logger.warn("Removing stale embedded PostgreSQL lock file");
      rmSync(postmasterPidFile, { force: true });
    }
    await embeddedPostgres.start();
    embeddedPostgresStartedByThisProcess = true;
  }

  const embeddedAdminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
  const dbStatus = await ensurePostgresDatabase(embeddedAdminConnectionString, "paperclip");
  if (dbStatus === "created") {
    logger.info("Created embedded PostgreSQL database: paperclip");
  }

  const embeddedConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
  migrationSummary = await ensureMigrations(embeddedConnectionString, "Embedded PostgreSQL");

  db = createDb(embeddedConnectionString);
  logger.info("Embedded PostgreSQL ready");
  startupDbInfo = { mode: "embedded-postgres", dataDir, port };
}

const uiMode = config.uiDevMiddleware ? "vite-dev" : config.serveUi ? "static" : "none";
const app = await createApp(db as any, { uiMode });
const server = createServer(app);
const listenPort = await detectPort(config.port);

if (listenPort !== config.port) {
  logger.warn({ requestedPort: config.port, selectedPort: listenPort }, "Requested port is busy; using next free port");
}

setupLiveEventsWebSocketServer(server, db as any);

if (config.heartbeatSchedulerEnabled) {
  const heartbeat = heartbeatService(db as any);

  // Reap orphaned runs at startup (no threshold -- runningProcesses is empty)
  void heartbeat.reapOrphanedRuns().catch((err) => {
    logger.error({ err }, "startup reap of orphaned heartbeat runs failed");
  });

  setInterval(() => {
    void heartbeat
      .tickTimers(new Date())
      .then((result) => {
        if (result.enqueued > 0) {
          logger.info({ ...result }, "heartbeat timer tick enqueued runs");
        }
      })
      .catch((err) => {
        logger.error({ err }, "heartbeat timer tick failed");
      });

    // Periodically reap orphaned runs (5-min staleness threshold)
    void heartbeat
      .reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 })
      .catch((err) => {
        logger.error({ err }, "periodic reap of orphaned heartbeat runs failed");
      });
  }, config.heartbeatSchedulerIntervalMs);
}

server.listen(listenPort, () => {
  logger.info(`Server listening on :${listenPort}`);
  printStartupBanner({
    requestedPort: config.port,
    listenPort,
    uiMode,
    db: startupDbInfo,
    migrationSummary,
    heartbeatSchedulerEnabled: config.heartbeatSchedulerEnabled,
    heartbeatSchedulerIntervalMs: config.heartbeatSchedulerIntervalMs,
  });
});

if (embeddedPostgres && embeddedPostgresStartedByThisProcess) {
  const shutdown = async (signal: "SIGINT" | "SIGTERM") => {
    logger.info({ signal }, "Stopping embedded PostgreSQL");
    try {
      await embeddedPostgres?.stop();
    } catch (err) {
      logger.error({ err }, "Failed to stop embedded PostgreSQL cleanly");
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}
