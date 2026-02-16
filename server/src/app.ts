import express, { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "@paperclip/db";
import { httpLogger, errorHandler } from "./middleware/index.js";
import { healthRoutes } from "./routes/health.js";
import { agentRoutes } from "./routes/agents.js";
import { projectRoutes } from "./routes/projects.js";
import { issueRoutes } from "./routes/issues.js";
import { goalRoutes } from "./routes/goals.js";
import { activityRoutes } from "./routes/activity.js";

export function createApp(db: Db, opts: { serveUi: boolean }) {
  const app = express();

  app.use(express.json());
  app.use(httpLogger);

  // Mount API routes
  const api = Router();
  api.use("/health", healthRoutes());
  api.use("/agents", agentRoutes(db));
  api.use("/projects", projectRoutes(db));
  api.use("/issues", issueRoutes(db));
  api.use("/goals", goalRoutes(db));
  api.use("/activity", activityRoutes(db));
  app.use("/api", api);

  // SPA fallback for serving the UI build
  if (opts.serveUi) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const uiDist = path.resolve(__dirname, "../../ui/dist");
    app.use(express.static(uiDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(uiDist, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
