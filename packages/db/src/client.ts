import { mkdirSync } from "node:fs";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema/index.js";

export function createDb(url: string) {
  const sql = postgres(url);
  return drizzlePg(sql, { schema });
}

export async function createPgliteDb(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite({ client, schema });

  // Auto-push schema to PGlite on startup (like drizzle-kit push)
  const { pushSchema } = await import("drizzle-kit/api");
  const { apply } = await pushSchema(schema, db as any);
  await apply();

  return db;
}

export type Db = ReturnType<typeof createDb>;
