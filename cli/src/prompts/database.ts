import * as p from "@clack/prompts";
import type { DatabaseConfig } from "../config/schema.js";

export async function promptDatabase(): Promise<DatabaseConfig> {
  const mode = await p.select({
    message: "Database mode",
    options: [
      { value: "pglite" as const, label: "PGlite (embedded, no setup needed)", hint: "recommended" },
      { value: "postgres" as const, label: "PostgreSQL (external server)" },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  if (mode === "postgres") {
    const connectionString = await p.text({
      message: "PostgreSQL connection string",
      placeholder: "postgres://user:pass@localhost:5432/paperclip",
      validate: (val) => {
        if (!val) return "Connection string is required for PostgreSQL mode";
        if (!val.startsWith("postgres")) return "Must be a postgres:// or postgresql:// URL";
      },
    });

    if (p.isCancel(connectionString)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }

    return { mode: "postgres", connectionString, pgliteDataDir: "./data/pglite" };
  }

  const pgliteDataDir = await p.text({
    message: "PGlite data directory",
    defaultValue: "./data/pglite",
    placeholder: "./data/pglite",
  });

  if (p.isCancel(pgliteDataDir)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  return { mode: "pglite", pgliteDataDir: pgliteDataDir || "./data/pglite" };
}
