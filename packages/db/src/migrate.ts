import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";

const migrationsFolder = new URL("./migrations", import.meta.url).pathname;
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is required for db:migrate");
}

const sql = postgres(url, { max: 1 });
const db = drizzlePg(sql);
await migratePg(db, { migrationsFolder });
await sql.end();

console.log("Migrations complete");
