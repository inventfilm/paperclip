import { readConfigFile } from "./config-file.js";

export interface Config {
  port: number;
  databaseUrl: string | undefined;
  serveUi: boolean;
  heartbeatSchedulerEnabled: boolean;
  heartbeatSchedulerIntervalMs: number;
}

export function loadConfig(): Config {
  const fileConfig = readConfigFile();

  const fileDbUrl =
    fileConfig?.database.mode === "postgres"
      ? fileConfig.database.connectionString
      : undefined;

  return {
    port: Number(process.env.PORT) || fileConfig?.server.port || 3100,
    databaseUrl: process.env.DATABASE_URL ?? fileDbUrl,
    serveUi:
      process.env.SERVE_UI !== undefined
        ? process.env.SERVE_UI === "true"
        : fileConfig?.server.serveUi ?? false,
    heartbeatSchedulerEnabled: process.env.HEARTBEAT_SCHEDULER_ENABLED !== "false",
    heartbeatSchedulerIntervalMs: Math.max(10000, Number(process.env.HEARTBEAT_SCHEDULER_INTERVAL_MS) || 30000),
  };
}
