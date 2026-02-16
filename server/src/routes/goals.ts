import { Router } from "express";
import type { Db } from "@paperclip/db";
import { createGoalSchema, updateGoalSchema } from "@paperclip/shared";
import { validate } from "../middleware/validate.js";
import { goalService } from "../services/goals.js";

export function goalRoutes(db: Db) {
  const router = Router();
  const svc = goalService(db);

  router.get("/", async (_req, res) => {
    const result = await svc.list();
    res.json(result);
  });

  router.get("/:id", async (req, res) => {
    const id = req.params.id as string;
    const goal = await svc.getById(id);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    res.json(goal);
  });

  router.post("/", validate(createGoalSchema), async (req, res) => {
    const goal = await svc.create(req.body);
    res.status(201).json(goal);
  });

  router.patch("/:id", validate(updateGoalSchema), async (req, res) => {
    const id = req.params.id as string;
    const goal = await svc.update(id, req.body);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    res.json(goal);
  });

  router.delete("/:id", async (req, res) => {
    const id = req.params.id as string;
    const goal = await svc.remove(id);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    res.json(goal);
  });

  return router;
}
