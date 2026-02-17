import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";

const migrationsFolder = new URL("./migrations", import.meta.url).pathname;
const url = process.env.DATABASE_URL;

if (url) {
  const sql = postgres(url, { max: 1 });
  const db = drizzlePg(sql);
  await migratePg(db, { migrationsFolder });
  await sql.end();
} else {
  const client = new PGlite("./data/pglite");
  const db = drizzlePglite({ client });
  await migratePglite(db, { migrationsFolder });
  await client.close();
}

console.log("Migrations complete");
