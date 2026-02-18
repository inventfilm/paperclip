import { existsSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import {
  createDb,
  ensurePostgresDatabase,
  migratePostgresIfEmpty,
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

let db;
let embeddedPostgres: EmbeddedPostgresInstance | null = null;
let embeddedPostgresStartedByThisProcess = false;
let migrationSummary = "skipped";
let startupDbInfo:
  | { mode: "external-postgres"; connectionString: string }
  | { mode: "embedded-postgres"; dataDir: string; port: number };
if (config.databaseUrl) {
  const migration = await migratePostgresIfEmpty(config.databaseUrl);
  if (migration.migrated) {
    logger.info("Empty PostgreSQL database detected; applied migrations");
    migrationSummary = "applied (empty database)";
  } else if (migration.reason === "not-empty-no-migration-journal") {
    logger.warn(
      { tableCount: migration.tableCount },
      "PostgreSQL has existing tables but no migration journal; skipped auto-migrate",
    );
    migrationSummary = "skipped (existing schema, no migration journal)";
  } else {
    migrationSummary = "already applied";
  }

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
  const migration = await migratePostgresIfEmpty(embeddedConnectionString);
  if (migration.migrated) {
    logger.info("Empty embedded PostgreSQL database detected; applied migrations");
    migrationSummary = "applied (empty database)";
  } else if (migration.reason === "not-empty-no-migration-journal") {
    logger.warn(
      { tableCount: migration.tableCount },
      "Embedded PostgreSQL has existing tables but no migration journal; skipped auto-migrate",
    );
    migrationSummary = "skipped (existing schema, no migration journal)";
  } else {
    migrationSummary = "already applied";
  }

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
