import { createDb } from "@paperclip/db";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { logger } from "./middleware/logger.js";

const config = loadConfig();
const db = createDb(config.databaseUrl);
const app = createApp(db, { serveUi: config.serveUi });

app.listen(config.port, () => {
  logger.info(`Server listening on :${config.port}`);
});
