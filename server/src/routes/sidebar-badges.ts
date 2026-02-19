import { Router } from "express";
import type { Db } from "@paperclip/db";
import { sidebarBadgeService } from "../services/sidebar-badges.js";
import { assertCompanyAccess } from "./authz.js";

export function sidebarBadgeRoutes(db: Db) {
  const router = Router();
  const svc = sidebarBadgeService(db);

  router.get("/companies/:companyId/sidebar-badges", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const badges = await svc.get(companyId);
    res.json(badges);
  });

  return router;
}
