import { Router } from "express";
import type { Db } from "@paperclip/db";
import { createProjectSchema, updateProjectSchema } from "@paperclip/shared";
import { validate } from "../middleware/validate.js";
import { projectService } from "../services/projects.js";

export function projectRoutes(db: Db) {
  const router = Router();
  const svc = projectService(db);

  router.get("/", async (_req, res) => {
    const result = await svc.list();
    res.json(result);
  });

  router.get("/:id", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  });

  router.post("/", validate(createProjectSchema), async (req, res) => {
    const project = await svc.create(req.body);
    res.status(201).json(project);
  });

  router.patch("/:id", validate(updateProjectSchema), async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.update(id, req.body);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  });

  router.delete("/:id", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.remove(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  });

  return router;
}
