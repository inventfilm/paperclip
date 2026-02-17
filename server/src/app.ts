import express, { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "@paperclip/db";
import { httpLogger, errorHandler } from "./middleware/index.js";
import { actorMiddleware } from "./middleware/auth.js";
import { healthRoutes } from "./routes/health.js";
import { companyRoutes } from "./routes/companies.js";
import { agentRoutes } from "./routes/agents.js";
import { projectRoutes } from "./routes/projects.js";
import { issueRoutes } from "./routes/issues.js";
import { goalRoutes } from "./routes/goals.js";
import { approvalRoutes } from "./routes/approvals.js";
import { costRoutes } from "./routes/costs.js";
import { activityRoutes } from "./routes/activity.js";
import { dashboardRoutes } from "./routes/dashboard.js";

export function createApp(db: Db, opts: { serveUi: boolean }) {
  const app = express();

  app.use(express.json());
  app.use(httpLogger);
  app.use(actorMiddleware(db));

  // Mount API routes
  const api = Router();
  api.use("/health", healthRoutes());
  api.use("/companies", companyRoutes(db));
  api.use(agentRoutes(db));
  api.use(projectRoutes(db));
  api.use(issueRoutes(db));
  api.use(goalRoutes(db));
  api.use(approvalRoutes(db));
  api.use(costRoutes(db));
  api.use(activityRoutes(db));
  api.use(dashboardRoutes(db));
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
