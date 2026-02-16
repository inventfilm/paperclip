import { Router } from "express";
import type { Db } from "@paperclip/db";
import { createAgentSchema, updateAgentSchema } from "@paperclip/shared";
import { validate } from "../middleware/validate.js";
import { agentService } from "../services/agents.js";

export function agentRoutes(db: Db) {
  const router = Router();
  const svc = agentService(db);

  router.get("/", async (_req, res) => {
    const result = await svc.list();
    res.json(result);
  });

  router.get("/:id", async (req, res) => {
    const id = req.params.id as string;
    const agent = await svc.getById(id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(agent);
  });

  router.post("/", validate(createAgentSchema), async (req, res) => {
    const agent = await svc.create(req.body);
    res.status(201).json(agent);
  });

  router.patch("/:id", validate(updateAgentSchema), async (req, res) => {
    const id = req.params.id as string;
    const agent = await svc.update(id, req.body);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(agent);
  });

  router.delete("/:id", async (req, res) => {
    const id = req.params.id as string;
    const agent = await svc.remove(id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(agent);
  });

  return router;
}
