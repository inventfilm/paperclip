import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import type { Request } from "express";
import { and, eq, isNull, desc } from "drizzle-orm";
import type { Db } from "@paperclip/db";
import {
  agentApiKeys,
  authUsers,
  invites,
  joinRequests,
} from "@paperclip/db";
import {
  acceptInviteSchema,
  createCompanyInviteSchema,
  listJoinRequestsQuerySchema,
  updateMemberPermissionsSchema,
  updateUserCompanyAccessSchema,
  PERMISSION_KEYS,
} from "@paperclip/shared";
import { forbidden, conflict, notFound, unauthorized, badRequest } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { accessService, agentService, logActivity } from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createInviteToken() {
  return `pcp_invite_${randomBytes(24).toString("hex")}`;
}

function requestIp(req: Request) {
  const forwarded = req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip || "unknown";
}

function inviteExpired(invite: typeof invites.$inferSelect) {
  return invite.expiresAt.getTime() <= Date.now();
}

function isLocalImplicit(req: Request) {
  return req.actor.type === "board" && req.actor.source === "local_implicit";
}

async function resolveActorEmail(db: Db, req: Request): Promise<string | null> {
  if (isLocalImplicit(req)) return "local@paperclip.local";
  const userId = req.actor.userId;
  if (!userId) return null;
  const user = await db
    .select({ email: authUsers.email })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .then((rows) => rows[0] ?? null);
  return user?.email ?? null;
}

function grantsFromDefaults(
  defaultsPayload: Record<string, unknown> | null | undefined,
  key: "human" | "agent",
): Array<{ permissionKey: (typeof PERMISSION_KEYS)[number]; scope: Record<string, unknown> | null }> {
  if (!defaultsPayload || typeof defaultsPayload !== "object") return [];
  const scoped = defaultsPayload[key];
  if (!scoped || typeof scoped !== "object") return [];
  const grants = (scoped as Record<string, unknown>).grants;
  if (!Array.isArray(grants)) return [];
  const validPermissionKeys = new Set<string>(PERMISSION_KEYS);
  const result: Array<{
    permissionKey: (typeof PERMISSION_KEYS)[number];
    scope: Record<string, unknown> | null;
  }> = [];
  for (const item of grants) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.permissionKey !== "string") continue;
    if (!validPermissionKeys.has(record.permissionKey)) continue;
    result.push({
      permissionKey: record.permissionKey as (typeof PERMISSION_KEYS)[number],
      scope:
        record.scope && typeof record.scope === "object" && !Array.isArray(record.scope)
          ? (record.scope as Record<string, unknown>)
          : null,
    });
  }
  return result;
}

export function accessRoutes(db: Db) {
  const router = Router();
  const access = accessService(db);
  const agents = agentService(db);

  async function assertInstanceAdmin(req: Request) {
    if (req.actor.type !== "board") throw unauthorized();
    if (isLocalImplicit(req)) return;
    const allowed = await access.isInstanceAdmin(req.actor.userId);
    if (!allowed) throw forbidden("Instance admin required");
  }

  async function assertCompanyPermission(req: Request, companyId: string, permissionKey: any) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "agent") {
      if (!req.actor.agentId) throw forbidden();
      const allowed = await access.hasPermission(companyId, "agent", req.actor.agentId, permissionKey);
      if (!allowed) throw forbidden("Permission denied");
      return;
    }
    if (req.actor.type !== "board") throw unauthorized();
    if (isLocalImplicit(req)) return;
    const allowed = await access.canUser(companyId, req.actor.userId, permissionKey);
    if (!allowed) throw forbidden("Permission denied");
  }

  router.post(
    "/companies/:companyId/invites",
    validate(createCompanyInviteSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCompanyPermission(req, companyId, "users:invite");

      const token = createInviteToken();
      const created = await db
        .insert(invites)
        .values({
          companyId,
          inviteType: "company_join",
          tokenHash: hashToken(token),
          allowedJoinTypes: req.body.allowedJoinTypes,
          defaultsPayload: req.body.defaultsPayload ?? null,
          expiresAt: new Date(Date.now() + req.body.expiresInHours * 60 * 60 * 1000),
          invitedByUserId: req.actor.userId ?? null,
        })
        .returning()
        .then((rows) => rows[0]);

      await logActivity(db, {
        companyId,
        actorType: req.actor.type === "agent" ? "agent" : "user",
        actorId: req.actor.type === "agent" ? req.actor.agentId ?? "unknown-agent" : req.actor.userId ?? "board",
        action: "invite.created",
        entityType: "invite",
        entityId: created.id,
        details: {
          inviteType: created.inviteType,
          allowedJoinTypes: created.allowedJoinTypes,
          expiresAt: created.expiresAt.toISOString(),
        },
      });

      res.status(201).json({
        ...created,
        token,
        inviteUrl: `/invite/${token}`,
      });
    },
  );

  router.get("/invites/:token", async (req, res) => {
    const token = (req.params.token as string).trim();
    if (!token) throw notFound("Invite not found");
    const invite = await db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(token)))
      .then((rows) => rows[0] ?? null);
    if (!invite || invite.revokedAt || invite.acceptedAt || inviteExpired(invite)) {
      throw notFound("Invite not found");
    }

    res.json({
      id: invite.id,
      companyId: invite.companyId,
      inviteType: invite.inviteType,
      allowedJoinTypes: invite.allowedJoinTypes,
      expiresAt: invite.expiresAt,
    });
  });

  router.post("/invites/:token/accept", validate(acceptInviteSchema), async (req, res) => {
    const token = (req.params.token as string).trim();
    if (!token) throw notFound("Invite not found");

    const invite = await db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(token)))
      .then((rows) => rows[0] ?? null);
    if (!invite || invite.revokedAt || invite.acceptedAt || inviteExpired(invite)) {
      throw notFound("Invite not found");
    }

    if (invite.inviteType === "bootstrap_ceo") {
      if (req.body.requestType !== "human") {
        throw badRequest("Bootstrap invite requires human request type");
      }
      if (req.actor.type !== "board" || (!req.actor.userId && !isLocalImplicit(req))) {
        throw unauthorized("Authenticated user required for bootstrap acceptance");
      }
      const userId = req.actor.userId ?? "local-board";
      const existingAdmin = await access.isInstanceAdmin(userId);
      if (!existingAdmin) {
        await access.promoteInstanceAdmin(userId);
      }
      const updatedInvite = await db
        .update(invites)
        .set({ acceptedAt: new Date(), updatedAt: new Date() })
        .where(eq(invites.id, invite.id))
        .returning()
        .then((rows) => rows[0] ?? invite);
      res.status(202).json({
        inviteId: updatedInvite.id,
        inviteType: updatedInvite.inviteType,
        bootstrapAccepted: true,
        userId,
      });
      return;
    }

    const requestType = req.body.requestType as "human" | "agent";
    const companyId = invite.companyId;
    if (!companyId) throw conflict("Invite is missing company scope");
    if (invite.allowedJoinTypes !== "both" && invite.allowedJoinTypes !== requestType) {
      throw badRequest(`Invite does not allow ${requestType} joins`);
    }

    if (requestType === "human" && req.actor.type !== "board") {
      throw unauthorized("Human invite acceptance requires authenticated user");
    }
    if (requestType === "human" && !req.actor.userId && !isLocalImplicit(req)) {
      throw unauthorized("Authenticated user is required");
    }
    if (requestType === "agent" && !req.body.agentName) {
      throw badRequest("agentName is required for agent join requests");
    }

    const actorEmail = requestType === "human" ? await resolveActorEmail(db, req) : null;
    const created = await db.transaction(async (tx) => {
      await tx
        .update(invites)
        .set({ acceptedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(invites.id, invite.id), isNull(invites.acceptedAt), isNull(invites.revokedAt)));

      const row = await tx
        .insert(joinRequests)
        .values({
          inviteId: invite.id,
          companyId,
          requestType,
          status: "pending_approval",
          requestIp: requestIp(req),
          requestingUserId: requestType === "human" ? req.actor.userId ?? "local-board" : null,
          requestEmailSnapshot: requestType === "human" ? actorEmail : null,
          agentName: requestType === "agent" ? req.body.agentName : null,
          adapterType: requestType === "agent" ? req.body.adapterType ?? null : null,
          capabilities: requestType === "agent" ? req.body.capabilities ?? null : null,
          agentDefaultsPayload: requestType === "agent" ? req.body.agentDefaultsPayload ?? null : null,
        })
        .returning()
        .then((rows) => rows[0]);
      return row;
    });

    await logActivity(db, {
      companyId,
      actorType: req.actor.type === "agent" ? "agent" : "user",
      actorId:
        req.actor.type === "agent"
          ? req.actor.agentId ?? "invite-agent"
          : req.actor.userId ?? (requestType === "agent" ? "invite-anon" : "board"),
      action: "join.requested",
      entityType: "join_request",
      entityId: created.id,
      details: { requestType, requestIp: created.requestIp },
    });

    res.status(202).json(created);
  });

  router.post("/invites/:inviteId/revoke", async (req, res) => {
    const id = req.params.inviteId as string;
    const invite = await db.select().from(invites).where(eq(invites.id, id)).then((rows) => rows[0] ?? null);
    if (!invite) throw notFound("Invite not found");
    if (invite.inviteType === "bootstrap_ceo") {
      await assertInstanceAdmin(req);
    } else {
      if (!invite.companyId) throw conflict("Invite is missing company scope");
      await assertCompanyPermission(req, invite.companyId, "users:invite");
    }
    if (invite.acceptedAt) throw conflict("Invite already consumed");
    if (invite.revokedAt) return res.json(invite);

    const revoked = await db
      .update(invites)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(invites.id, id))
      .returning()
      .then((rows) => rows[0]);

    if (invite.companyId) {
      await logActivity(db, {
        companyId: invite.companyId,
        actorType: req.actor.type === "agent" ? "agent" : "user",
        actorId: req.actor.type === "agent" ? req.actor.agentId ?? "unknown-agent" : req.actor.userId ?? "board",
        action: "invite.revoked",
        entityType: "invite",
        entityId: id,
      });
    }

    res.json(revoked);
  });

  router.get("/companies/:companyId/join-requests", async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertCompanyPermission(req, companyId, "joins:approve");
    const query = listJoinRequestsQuerySchema.parse(req.query);
    const all = await db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.companyId, companyId))
      .orderBy(desc(joinRequests.createdAt));
    const filtered = all.filter((row) => {
      if (query.status && row.status !== query.status) return false;
      if (query.requestType && row.requestType !== query.requestType) return false;
      return true;
    });
    res.json(filtered);
  });

  router.post("/companies/:companyId/join-requests/:requestId/approve", async (req, res) => {
    const companyId = req.params.companyId as string;
    const requestId = req.params.requestId as string;
    await assertCompanyPermission(req, companyId, "joins:approve");

    const existing = await db
      .select()
      .from(joinRequests)
      .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.id, requestId)))
      .then((rows) => rows[0] ?? null);
    if (!existing) throw notFound("Join request not found");
    if (existing.status !== "pending_approval") throw conflict("Join request is not pending");

    const invite = await db
      .select()
      .from(invites)
      .where(eq(invites.id, existing.inviteId))
      .then((rows) => rows[0] ?? null);
    if (!invite) throw notFound("Invite not found");

    let createdAgentId: string | null = existing.createdAgentId ?? null;
    if (existing.requestType === "human") {
      if (!existing.requestingUserId) throw conflict("Join request missing user identity");
      await access.ensureMembership(companyId, "user", existing.requestingUserId, "member", "active");
      const grants = grantsFromDefaults(invite.defaultsPayload as Record<string, unknown> | null, "human");
      await access.setPrincipalGrants(
        companyId,
        "user",
        existing.requestingUserId,
        grants,
        req.actor.userId ?? null,
      );
    } else {
      const created = await agents.create(companyId, {
        name: existing.agentName ?? "New Agent",
        role: "general",
        title: null,
        status: "idle",
        reportsTo: null,
        capabilities: existing.capabilities ?? null,
        adapterType: existing.adapterType ?? "process",
        adapterConfig:
          existing.agentDefaultsPayload && typeof existing.agentDefaultsPayload === "object"
            ? (existing.agentDefaultsPayload as Record<string, unknown>)
            : {},
        runtimeConfig: {},
        budgetMonthlyCents: 0,
        spentMonthlyCents: 0,
        permissions: {},
        lastHeartbeatAt: null,
        metadata: null,
      });
      createdAgentId = created.id;
      await access.ensureMembership(companyId, "agent", created.id, "member", "active");
      const grants = grantsFromDefaults(invite.defaultsPayload as Record<string, unknown> | null, "agent");
      await access.setPrincipalGrants(companyId, "agent", created.id, grants, req.actor.userId ?? null);
    }

    const approved = await db
      .update(joinRequests)
      .set({
        status: "approved",
        approvedByUserId: req.actor.userId ?? (isLocalImplicit(req) ? "local-board" : null),
        approvedAt: new Date(),
        createdAgentId,
        updatedAt: new Date(),
      })
      .where(eq(joinRequests.id, requestId))
      .returning()
      .then((rows) => rows[0]);

    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "join.approved",
      entityType: "join_request",
      entityId: requestId,
      details: { requestType: existing.requestType, createdAgentId },
    });

    res.json(approved);
  });

  router.post("/companies/:companyId/join-requests/:requestId/reject", async (req, res) => {
    const companyId = req.params.companyId as string;
    const requestId = req.params.requestId as string;
    await assertCompanyPermission(req, companyId, "joins:approve");

    const existing = await db
      .select()
      .from(joinRequests)
      .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.id, requestId)))
      .then((rows) => rows[0] ?? null);
    if (!existing) throw notFound("Join request not found");
    if (existing.status !== "pending_approval") throw conflict("Join request is not pending");

    const rejected = await db
      .update(joinRequests)
      .set({
        status: "rejected",
        rejectedByUserId: req.actor.userId ?? (isLocalImplicit(req) ? "local-board" : null),
        rejectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(joinRequests.id, requestId))
      .returning()
      .then((rows) => rows[0]);

    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "join.rejected",
      entityType: "join_request",
      entityId: requestId,
      details: { requestType: existing.requestType },
    });

    res.json(rejected);
  });

  router.post("/join-requests/:requestId/claim-api-key", async (req, res) => {
    const requestId = req.params.requestId as string;
    const joinRequest = await db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, requestId))
      .then((rows) => rows[0] ?? null);
    if (!joinRequest) throw notFound("Join request not found");
    if (joinRequest.requestType !== "agent") throw badRequest("Only agent join requests can claim API keys");
    if (joinRequest.status !== "approved") throw conflict("Join request must be approved before key claim");
    if (!joinRequest.createdAgentId) throw conflict("Join request has no created agent");

    const existingKey = await db
      .select({ id: agentApiKeys.id })
      .from(agentApiKeys)
      .where(eq(agentApiKeys.agentId, joinRequest.createdAgentId))
      .then((rows) => rows[0] ?? null);
    if (existingKey) throw conflict("API key already claimed");

    const created = await agents.createApiKey(joinRequest.createdAgentId, "initial-join-key");

    await logActivity(db, {
      companyId: joinRequest.companyId,
      actorType: "system",
      actorId: "join-claim",
      action: "agent_api_key.claimed",
      entityType: "agent_api_key",
      entityId: created.id,
      details: { agentId: joinRequest.createdAgentId, joinRequestId: requestId },
    });

    res.status(201).json({
      keyId: created.id,
      token: created.token,
      agentId: joinRequest.createdAgentId,
      createdAt: created.createdAt,
    });
  });

  router.get("/companies/:companyId/members", async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertCompanyPermission(req, companyId, "users:manage_permissions");
    const members = await access.listMembers(companyId);
    res.json(members);
  });

  router.patch(
    "/companies/:companyId/members/:memberId/permissions",
    validate(updateMemberPermissionsSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const memberId = req.params.memberId as string;
      await assertCompanyPermission(req, companyId, "users:manage_permissions");
      const updated = await access.setMemberPermissions(
        companyId,
        memberId,
        req.body.grants ?? [],
        req.actor.userId ?? null,
      );
      if (!updated) throw notFound("Member not found");
      res.json(updated);
    },
  );

  router.post("/admin/users/:userId/promote-instance-admin", async (req, res) => {
    await assertInstanceAdmin(req);
    const userId = req.params.userId as string;
    const result = await access.promoteInstanceAdmin(userId);
    res.status(201).json(result);
  });

  router.post("/admin/users/:userId/demote-instance-admin", async (req, res) => {
    await assertInstanceAdmin(req);
    const userId = req.params.userId as string;
    const removed = await access.demoteInstanceAdmin(userId);
    if (!removed) throw notFound("Instance admin role not found");
    res.json(removed);
  });

  router.get("/admin/users/:userId/company-access", async (req, res) => {
    await assertInstanceAdmin(req);
    const userId = req.params.userId as string;
    const memberships = await access.listUserCompanyAccess(userId);
    res.json(memberships);
  });

  router.put(
    "/admin/users/:userId/company-access",
    validate(updateUserCompanyAccessSchema),
    async (req, res) => {
      await assertInstanceAdmin(req);
      const userId = req.params.userId as string;
      const memberships = await access.setUserCompanyAccess(userId, req.body.companyIds ?? []);
      res.json(memberships);
    },
  );

  return router;
}
