import { readConfigFile } from "./config-file.js";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { resolvePaperclipEnvPath } from "./paths.js";
import { SECRET_PROVIDERS, type SecretProvider } from "@paperclip/shared";

const PAPERCLIP_ENV_FILE_PATH = resolvePaperclipEnvPath();
if (existsSync(PAPERCLIP_ENV_FILE_PATH)) {
  loadDotenv({ path: PAPERCLIP_ENV_FILE_PATH, override: false, quiet: true });
}

type DatabaseMode = "embedded-postgres" | "postgres";

export interface Config {
  port: number;
  databaseMode: DatabaseMode;
  databaseUrl: string | undefined;
  embeddedPostgresDataDir: string;
  embeddedPostgresPort: number;
  serveUi: boolean;
  uiDevMiddleware: boolean;
  secretsProvider: SecretProvider;
  secretsStrictMode: boolean;
  secretsMasterKeyFilePath: string;
  heartbeatSchedulerEnabled: boolean;
  heartbeatSchedulerIntervalMs: number;
}

export function loadConfig(): Config {
  const fileConfig = readConfigFile();
  const fileDatabaseMode =
    (fileConfig?.database.mode === "postgres" ? "postgres" : "embedded-postgres") as DatabaseMode;

  const fileDbUrl =
    fileDatabaseMode === "postgres"
      ? fileConfig?.database.connectionString
      : undefined;
  const fileSecrets = fileConfig?.secrets;
  const strictModeFromEnv = process.env.PAPERCLIP_SECRETS_STRICT_MODE;
  const secretsStrictMode =
    strictModeFromEnv !== undefined
      ? strictModeFromEnv === "true"
      : (fileSecrets?.strictMode ?? false);

  const providerFromEnvRaw = process.env.PAPERCLIP_SECRETS_PROVIDER;
  const providerFromEnv =
    providerFromEnvRaw && SECRET_PROVIDERS.includes(providerFromEnvRaw as SecretProvider)
      ? (providerFromEnvRaw as SecretProvider)
      : null;
  const providerFromFile = fileSecrets?.provider;
  const secretsProvider: SecretProvider = providerFromEnv ?? providerFromFile ?? "local_encrypted";

  return {
    port: Number(process.env.PORT) || fileConfig?.server.port || 3100,
    databaseMode: fileDatabaseMode,
    databaseUrl: process.env.DATABASE_URL ?? fileDbUrl,
    embeddedPostgresDataDir: fileConfig?.database.embeddedPostgresDataDir ?? "./data/embedded-postgres",
    embeddedPostgresPort: fileConfig?.database.embeddedPostgresPort ?? 54329,
    serveUi:
      process.env.SERVE_UI !== undefined
        ? process.env.SERVE_UI === "true"
        : fileConfig?.server.serveUi ?? true,
    uiDevMiddleware: process.env.PAPERCLIP_UI_DEV_MIDDLEWARE === "true",
    secretsProvider,
    secretsStrictMode,
    secretsMasterKeyFilePath:
      process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE ??
      fileSecrets?.localEncrypted.keyFilePath ??
      "./data/secrets/master.key",
    heartbeatSchedulerEnabled: process.env.HEARTBEAT_SCHEDULER_ENABLED !== "false",
    heartbeatSchedulerIntervalMs: Math.max(10000, Number(process.env.HEARTBEAT_SCHEDULER_INTERVAL_MS) || 30000),
  };
}
