import { Router } from "express";
import type { Db } from "@paperclip/db";
import { createApprovalSchema, resolveApprovalSchema } from "@paperclip/shared";
import { validate } from "../middleware/validate.js";
import { approvalService, logActivity } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function approvalRoutes(db: Db) {
  const router = Router();
  const svc = approvalService(db);

  router.get("/companies/:companyId/approvals", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const status = req.query.status as string | undefined;
    const result = await svc.list(companyId, status);
    res.json(result);
  });

  router.post("/companies/:companyId/approvals", validate(createApprovalSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const actor = getActorInfo(req);
    const approval = await svc.create(companyId, {
      ...req.body,
      requestedByUserId: actor.actorType === "user" ? actor.actorId : null,
      requestedByAgentId:
        req.body.requestedByAgentId ?? (actor.actorType === "agent" ? actor.actorId : null),
      status: "pending",
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: new Date(),
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "approval.created",
      entityType: "approval",
      entityId: approval.id,
      details: { type: approval.type },
    });

    res.status(201).json(approval);
  });

  router.post("/approvals/:id/approve", validate(resolveApprovalSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const approval = await svc.approve(id, req.body.decidedByUserId ?? "board", req.body.decisionNote);

    await logActivity(db, {
      companyId: approval.companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "approval.approved",
      entityType: "approval",
      entityId: approval.id,
      details: { type: approval.type },
    });

    res.json(approval);
  });

  router.post("/approvals/:id/reject", validate(resolveApprovalSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const approval = await svc.reject(id, req.body.decidedByUserId ?? "board", req.body.decisionNote);

    await logActivity(db, {
      companyId: approval.companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "approval.rejected",
      entityType: "approval",
      entityId: approval.id,
      details: { type: approval.type },
    });

    res.json(approval);
  });

  return router;
}
