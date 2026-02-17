import fs from "node:fs";
import path from "node:path";
import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";

export async function databaseCheck(config: PaperclipConfig): Promise<CheckResult> {
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

  // PGlite mode — check data dir
  const dataDir = path.resolve(config.database.pgliteDataDir);
  if (!fs.existsSync(dataDir)) {
    return {
      name: "Database",
      status: "warn",
      message: `PGlite data directory does not exist: ${dataDir}`,
      canRepair: true,
      repair: () => {
        fs.mkdirSync(dataDir, { recursive: true });
      },
    };
  }

  return {
    name: "Database",
    status: "pass",
    message: `PGlite data directory exists: ${dataDir}`,
  };
}
