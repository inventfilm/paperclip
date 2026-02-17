import { createDb, createPgliteDb } from "@paperclip/db";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { logger } from "./middleware/logger.js";

const config = loadConfig();

let db;
if (config.databaseUrl) {
  db = createDb(config.databaseUrl);
} else {
  logger.info("No DATABASE_URL set — using embedded PGlite (./data/pglite)");
  db = await createPgliteDb("./data/pglite");
  logger.info("PGlite ready, schema pushed");
}

const app = createApp(db as any, { serveUi: config.serveUi });

app.listen(config.port, () => {
  logger.info(`Server listening on :${config.port}`);
});
