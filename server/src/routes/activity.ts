import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclip/db";
import { validate } from "../middleware/validate.js";
import { activityService } from "../services/activity.js";

const createActivitySchema = z.object({
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  agentId: z.string().uuid().optional().nullable(),
  details: z.record(z.unknown()).optional().nullable(),
});

export function activityRoutes(db: Db) {
  const router = Router();
  const svc = activityService(db);

  router.get("/", async (req, res) => {
    const filters = {
      agentId: req.query.agentId as string | undefined,
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
    };
    const result = await svc.list(filters);
    res.json(result);
  });

  router.post("/", validate(createActivitySchema), async (req, res) => {
    const event = await svc.create(req.body);
    res.status(201).json(event);
  });

  return router;
}
