import fs from "node:fs";
import path from "node:path";
import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";

function resolveConfigRelativePath(value: string, configPath?: string): string {
  if (path.isAbsolute(value)) return value;
  const candidates = [path.resolve(value)];
  if (configPath) {
    candidates.unshift(path.resolve(path.dirname(configPath), "..", "server", value));
    candidates.unshift(path.resolve(path.dirname(configPath), value));
  }
  candidates.push(path.resolve(process.cwd(), "server", value));
  const uniqueCandidates = Array.from(new Set(candidates));
  return uniqueCandidates.find((candidate) => fs.existsSync(candidate)) ?? uniqueCandidates[0];
}

export async function databaseCheck(config: PaperclipConfig, configPath?: string): Promise<CheckResult> {
  if (config.database.mode === "postgres") {
    if (!config.database.connectionString) {
      return {
        name: "Database",
        status: "fail",
        message: "PostgreSQL mode selected but no connection string configured",
        canRepair: false,
        repairHint: "Run `paperclip configure --section database`",
      };
    }

    try {
      const { createDb } = await import("@paperclip/db");
      const db = createDb(config.database.connectionString);
      await db.execute("SELECT 1");
      return {
        name: "Database",
        status: "pass",
        message: "PostgreSQL connection successful",
      };
    } catch (err) {
      return {
        name: "Database",
        status: "fail",
        message: `Cannot connect to PostgreSQL: ${err instanceof Error ? err.message : String(err)}`,
        canRepair: false,
        repairHint: "Check your connection string and ensure PostgreSQL is running",
      };
    }
  }

  if (config.database.mode === "embedded-postgres") {
    const dataDir = resolveConfigRelativePath(config.database.embeddedPostgresDataDir, configPath);
    const reportedPath = dataDir;
    if (!fs.existsSync(dataDir)) {
      return {
        name: "Database",
        status: "warn",
        message: `Embedded PostgreSQL data directory does not exist: ${reportedPath}`,
        canRepair: true,
        repair: () => {
          fs.mkdirSync(reportedPath, { recursive: true });
        },
      };
    }

    return {
      name: "Database",
      status: "pass",
      message: `Embedded PostgreSQL configured at ${dataDir} (port ${config.database.embeddedPostgresPort})`,
    };
  }

  return {
    name: "Database",
    status: "fail",
    message: `Unknown database mode: ${String(config.database.mode)}`,
    canRepair: false,
    repairHint: "Run `paperclip configure --section database`",
  };
}
