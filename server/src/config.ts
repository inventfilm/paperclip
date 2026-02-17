export interface Config {
  port: number;
  databaseUrl: string | undefined;
  serveUi: boolean;
  heartbeatSchedulerEnabled: boolean;
  heartbeatSchedulerIntervalMs: number;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT) || 3100,
    databaseUrl: process.env.DATABASE_URL,
    serveUi: process.env.SERVE_UI === "true",
    heartbeatSchedulerEnabled: process.env.HEARTBEAT_SCHEDULER_ENABLED !== "false",
    heartbeatSchedulerIntervalMs: Math.max(10000, Number(process.env.HEARTBEAT_SCHEDULER_INTERVAL_MS) || 30000),
  };
}
