import { Router } from "express";
import type { Db } from "@paperclip/db";
import { createIssueSchema, updateIssueSchema } from "@paperclip/shared";
import { validate } from "../middleware/validate.js";
import { issueService } from "../services/issues.js";

export function issueRoutes(db: Db) {
  const router = Router();
  const svc = issueService(db);

  router.get("/", async (_req, res) => {
    const result = await svc.list();
    res.json(result);
  });

  router.get("/:id", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    res.json(issue);
  });

  router.post("/", validate(createIssueSchema), async (req, res) => {
    const issue = await svc.create(req.body);
    res.status(201).json(issue);
  });

  router.patch("/:id", validate(updateIssueSchema), async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.update(id, req.body);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    res.json(issue);
  });

  router.delete("/:id", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.remove(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    res.json(issue);
  });

  return router;
}
