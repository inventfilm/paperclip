import { Router, type Request, type Response } from "express";
import type { Db } from "@paperclip/db";
import {
  addIssueCommentSchema,
  checkoutIssueSchema,
  createIssueSchema,
  linkIssueApprovalSchema,
  updateIssueSchema,
} from "@paperclip/shared";
import { validate } from "../middleware/validate.js";
import {
  agentService,
  heartbeatService,
  issueApprovalService,
  issueService,
  logActivity,
} from "../services/index.js";
import { logger } from "../middleware/logger.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function issueRoutes(db: Db) {
  const router = Router();
  const svc = issueService(db);
  const heartbeat = heartbeatService(db);
  const agentsSvc = agentService(db);
  const issueApprovalsSvc = issueApprovalService(db);

  async function assertCanManageIssueApprovalLinks(req: Request, res: Response, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") return true;
    if (!req.actor.agentId) {
      res.status(403).json({ error: "Agent authentication required" });
      return false;
    }
    const actorAgent = await agentsSvc.getById(req.actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
    if (actorAgent.role === "ceo" || Boolean(actorAgent.permissions?.canCreateAgents)) return true;
    res.status(403).json({ error: "Missing permission to link approvals" });
    return false;
  }

  router.get("/companies/:companyId/issues", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId, {
      status: req.query.status as string | undefined,
      assigneeAgentId: req.query.assigneeAgentId as string | undefined,
      projectId: req.query.projectId as string | undefined,
    });
    res.json(result);
  });

  router.get("/issues/:id", async (req, res) => {
    const id = req.params.id as string;
    const isIdentifier = /^[A-Z]+-\d+$/i.test(id);
    const issue = isIdentifier ? await svc.getByIdentifier(id) : await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    const ancestors = await svc.getAncestors(issue.id);
    res.json({ ...issue, ancestors });
  });

  router.get("/issues/:id/approvals", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    const approvals = await issueApprovalsSvc.listApprovalsForIssue(id);
    res.json(approvals);
  });

  router.post("/issues/:id/approvals", validate(linkIssueApprovalSchema), async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    if (!(await assertCanManageIssueApprovalLinks(req, res, issue.companyId))) return;

    const actor = getActorInfo(req);
    await issueApprovalsSvc.link(id, req.body.approvalId, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.approval_linked",
      entityType: "issue",
      entityId: issue.id,
      details: { approvalId: req.body.approvalId },
    });

    const approvals = await issueApprovalsSvc.listApprovalsForIssue(id);
    res.status(201).json(approvals);
  });

  router.delete("/issues/:id/approvals/:approvalId", async (req, res) => {
    const id = req.params.id as string;
    const approvalId = req.params.approvalId as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    if (!(await assertCanManageIssueApprovalLinks(req, res, issue.companyId))) return;

    await issueApprovalsSvc.unlink(id, approvalId);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.approval_unlinked",
      entityType: "issue",
      entityId: issue.id,
      details: { approvalId },
    });

    res.json({ ok: true });
  });

  router.post("/companies/:companyId/issues", validate(createIssueSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const actor = getActorInfo(req);
    const issue = await svc.create(companyId, {
      ...req.body,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.created",
      entityType: "issue",
      entityId: issue.id,
      details: { title: issue.title },
    });

    if (issue.assigneeAgentId) {
      void heartbeat
        .wakeup(issue.assigneeAgentId, {
          source: "assignment",
          triggerDetail: "system",
          reason: "issue_assigned",
          payload: { issueId: issue.id, mutation: "create" },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: { issueId: issue.id, source: "issue.create" },
        })
        .catch((err) => logger.warn({ err, issueId: issue.id }, "failed to wake assignee on issue create"));
    }

    res.status(201).json(issue);
  });

  router.patch("/issues/:id", validate(updateIssueSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const { comment: commentBody, hiddenAt: hiddenAtRaw, ...updateFields } = req.body;
    if (hiddenAtRaw !== undefined) {
      updateFields.hiddenAt = hiddenAtRaw ? new Date(hiddenAtRaw) : null;
    }
    const issue = await svc.update(id, updateFields);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }

    // Build activity details with previous values for changed fields
    const previous: Record<string, unknown> = {};
    for (const key of Object.keys(updateFields)) {
      if (key in existing && (existing as Record<string, unknown>)[key] !== (updateFields as Record<string, unknown>)[key]) {
        previous[key] = (existing as Record<string, unknown>)[key];
      }
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.updated",
      entityType: "issue",
      entityId: issue.id,
      details: { ...updateFields, _previous: Object.keys(previous).length > 0 ? previous : undefined },
    });

    let comment = null;
    if (commentBody) {
      comment = await svc.addComment(id, commentBody, {
        agentId: actor.agentId ?? undefined,
        userId: actor.actorType === "user" ? actor.actorId : undefined,
      });

      await logActivity(db, {
        companyId: issue.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "issue.comment_added",
        entityType: "issue",
        entityId: issue.id,
        details: { commentId: comment.id },
      });

      // @-mention wakeups
      svc.findMentionedAgents(issue.companyId, commentBody).then((ids) => {
        for (const mentionedId of ids) {
          heartbeat.wakeup(mentionedId, {
            source: "automation",
            triggerDetail: "system",
            reason: `Mentioned in comment on issue ${id}`,
            payload: { issueId: id, commentId: comment!.id },
            requestedByActorType: actor.actorType,
            requestedByActorId: actor.actorId,
            contextSnapshot: { issueId: id, commentId: comment!.id, source: "comment.mention" },
          }).catch((err) => logger.warn({ err, agentId: mentionedId }, "failed to wake mentioned agent"));
        }
      }).catch((err) => logger.warn({ err, issueId: id }, "failed to resolve @-mentions"));
    }

    const assigneeChanged =
      req.body.assigneeAgentId !== undefined && req.body.assigneeAgentId !== existing.assigneeAgentId;
    const reopened =
      (existing.status === "done" || existing.status === "cancelled") &&
      issue.status !== "done" && issue.status !== "cancelled";

    if ((assigneeChanged || reopened) && issue.assigneeAgentId) {
      void heartbeat
        .wakeup(issue.assigneeAgentId, {
          source: reopened ? "automation" : "assignment",
          triggerDetail: "system",
          reason: reopened ? "issue_reopened" : "issue_assigned",
          payload: { issueId: issue.id, mutation: "update" },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: { issueId: issue.id, source: reopened ? "issue.reopen" : "issue.update" },
        })
        .catch((err) => logger.warn({ err, issueId: issue.id }, "failed to wake assignee on issue update"));
    }

    res.json({ ...issue, comment });
  });

  router.delete("/issues/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const issue = await svc.remove(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.deleted",
      entityType: "issue",
      entityId: issue.id,
    });

    res.json(issue);
  });

  router.post("/issues/:id/checkout", validate(checkoutIssueSchema), async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);

    if (req.actor.type === "agent" && req.actor.agentId !== req.body.agentId) {
      res.status(403).json({ error: "Agent can only checkout as itself" });
      return;
    }

    const updated = await svc.checkout(id, req.body.agentId, req.body.expectedStatuses);
    const actor = getActorInfo(req);

    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.checked_out",
      entityType: "issue",
      entityId: issue.id,
      details: { agentId: req.body.agentId },
    });

    void heartbeat
      .wakeup(req.body.agentId, {
        source: "assignment",
        triggerDetail: "system",
        reason: "issue_checked_out",
        payload: { issueId: issue.id, mutation: "checkout" },
        requestedByActorType: actor.actorType,
        requestedByActorId: actor.actorId,
        contextSnapshot: { issueId: issue.id, source: "issue.checkout" },
      })
      .catch((err) => logger.warn({ err, issueId: issue.id }, "failed to wake assignee on issue checkout"));

    res.json(updated);
  });

  router.post("/issues/:id/release", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const released = await svc.release(id, req.actor.type === "agent" ? req.actor.agentId : undefined);
    if (!released) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: released.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.released",
      entityType: "issue",
      entityId: released.id,
    });

    res.json(released);
  });

  router.get("/issues/:id/comments", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    const comments = await svc.listComments(id);
    res.json(comments);
  });

  router.post("/issues/:id/comments", validate(addIssueCommentSchema), async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);

    const actor = getActorInfo(req);
    const reopenRequested = req.body.reopen === true;
    const isClosed = issue.status === "done" || issue.status === "cancelled";
    let reopened = false;
    let reopenFromStatus: string | null = null;
    let currentIssue = issue;

    if (reopenRequested && isClosed) {
      const reopenedIssue = await svc.update(id, { status: "todo" });
      if (!reopenedIssue) {
        res.status(404).json({ error: "Issue not found" });
        return;
      }
      reopened = true;
      reopenFromStatus = issue.status;
      currentIssue = reopenedIssue;

      await logActivity(db, {
        companyId: currentIssue.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "issue.updated",
        entityType: "issue",
        entityId: currentIssue.id,
        details: {
          status: "todo",
          reopened: true,
          reopenedFrom: reopenFromStatus,
          source: "comment",
        },
      });
    }

    const comment = await svc.addComment(id, req.body.body, {
      agentId: actor.agentId ?? undefined,
      userId: actor.actorType === "user" ? actor.actorId : undefined,
    });

    await logActivity(db, {
      companyId: currentIssue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.comment_added",
      entityType: "issue",
      entityId: currentIssue.id,
      details: { commentId: comment.id },
    });

    // @-mention wakeups
    svc.findMentionedAgents(issue.companyId, req.body.body).then((ids) => {
      for (const mentionedId of ids) {
        heartbeat.wakeup(mentionedId, {
          source: "automation",
          triggerDetail: "system",
          reason: `Mentioned in comment on issue ${id}`,
          payload: { issueId: id, commentId: comment.id },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: { issueId: id, commentId: comment.id, source: "comment.mention" },
        }).catch((err) => logger.warn({ err, agentId: mentionedId }, "failed to wake mentioned agent"));
      }
    }).catch((err) => logger.warn({ err, issueId: id }, "failed to resolve @-mentions"));

    if (reopened && currentIssue.assigneeAgentId) {
      void heartbeat
        .wakeup(currentIssue.assigneeAgentId, {
          source: "automation",
          triggerDetail: "system",
          reason: "issue_reopened_via_comment",
          payload: {
            issueId: currentIssue.id,
            commentId: comment.id,
            reopenedFrom: reopenFromStatus,
            mutation: "comment",
          },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: {
            issueId: currentIssue.id,
            taskId: currentIssue.id,
            commentId: comment.id,
            source: "issue.comment.reopen",
            wakeReason: "issue_reopened_via_comment",
            reopenedFrom: reopenFromStatus,
          },
        })
        .catch((err) => logger.warn({ err, issueId: currentIssue.id }, "failed to wake assignee on issue reopen comment"));
    } else if (currentIssue.assigneeAgentId) {
      void heartbeat
        .wakeup(currentIssue.assigneeAgentId, {
          source: "automation",
          triggerDetail: "system",
          reason: "issue_commented",
          payload: {
            issueId: currentIssue.id,
            commentId: comment.id,
            mutation: "comment",
          },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: {
            issueId: currentIssue.id,
            taskId: currentIssue.id,
            commentId: comment.id,
            source: "issue.comment",
            wakeReason: "issue_commented",
          },
        })
        .catch((err) => logger.warn({ err, issueId: currentIssue.id }, "failed to wake assignee on issue comment"));
    }

    res.status(201).json(comment);
  });

  return router;
}
