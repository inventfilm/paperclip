import express, { Router } from "express";
import path from "node:path";
import fs from "node:fs";
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

type UiMode = "none" | "static" | "vite-dev";

export async function createApp(db: Db, opts: { uiMode: UiMode }) {
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

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  if (opts.uiMode === "static") {
    // Serve built UI from ui/dist in production.
    const uiDist = path.resolve(__dirname, "../../ui/dist");
    app.use(express.static(uiDist));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(uiDist, "index.html"));
    });
  }

  if (opts.uiMode === "vite-dev") {
    const uiRoot = path.resolve(__dirname, "../../ui");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: uiRoot,
      appType: "spa",
      server: {
        middlewareMode: true,
      },
    });

    app.use(vite.middlewares);
    app.get(/.*/, async (req, res, next) => {
      try {
        const templatePath = path.resolve(uiRoot, "index.html");
        const template = fs.readFileSync(templatePath, "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  app.use(errorHandler);

  return app;
}
