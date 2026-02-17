import { createServer } from "node:http";
import { resolve } from "node:path";
import { createDb, createPgliteDb } from "@paperclip/db";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { logger } from "./middleware/logger.js";
import { setupLiveEventsWebSocketServer } from "./realtime/live-events-ws.js";
import { heartbeatService } from "./services/index.js";

const config = loadConfig();

let db;
if (config.databaseUrl) {
  db = createDb(config.databaseUrl);
} else {
  const dataDir = resolve("./data/pglite");
  logger.info(`No DATABASE_URL set — using embedded PGlite (${dataDir})`);
  db = await createPgliteDb(dataDir);
  logger.info("PGlite ready, schema pushed");
}

const app = createApp(db as any, { serveUi: config.serveUi });
const server = createServer(app);

setupLiveEventsWebSocketServer(server, db as any);

if (config.heartbeatSchedulerEnabled) {
  const heartbeat = heartbeatService(db as any);
  setInterval(() => {
    void heartbeat
      .tickTimers(new Date())
      .then((result) => {
        if (result.enqueued > 0) {
          logger.info({ ...result }, "heartbeat timer tick enqueued runs");
        }
      })
      .catch((err) => {
        logger.error({ err }, "heartbeat timer tick failed");
      });
  }, config.heartbeatSchedulerIntervalMs);
}

server.listen(config.port, () => {
  logger.info(`Server listening on :${config.port}`);
});
