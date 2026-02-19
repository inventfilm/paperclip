import { Router, type Request } from "express";
import type { Db } from "@paperclip/db";
import { forbidden } from "../errors.js";
import { listServerAdapters } from "../adapters/index.js";
import { agentService } from "../services/agents.js";

function hasCreatePermission(agent: { role: string; permissions: Record<string, unknown> | null | undefined }) {
  if (!agent.permissions || typeof agent.permissions !== "object") return false;
  return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
}

export function llmRoutes(db: Db) {
  const router = Router();
  const agentsSvc = agentService(db);

  async function assertCanRead(req: Request) {
    if (req.actor.type === "board") return;
    if (req.actor.type !== "agent" || !req.actor.agentId) {
      throw forbidden("Board or permitted agent authentication required");
    }
    const actorAgent = await agentsSvc.getById(req.actor.agentId);
    if (!actorAgent || !hasCreatePermission(actorAgent)) {
      throw forbidden("Missing permission to read agent configuration reflection");
    }
  }

  router.get("/llms/agent-configuration.txt", async (req, res) => {
    await assertCanRead(req);
    const adapters = listServerAdapters().sort((a, b) => a.type.localeCompare(b.type));
    const lines = [
      "# Paperclip Agent Configuration Index",
      "",
      "Installed adapters:",
      ...adapters.map((adapter) => `- ${adapter.type}: /llms/agent-configuration/${adapter.type}.txt`),
      "",
      "Related API endpoints:",
      "- GET /api/companies/:companyId/agent-configurations",
      "- GET /api/agents/:id/configuration",
      "- POST /api/companies/:companyId/agent-hires",
      "",
      "Notes:",
      "- Sensitive values are redacted in configuration read APIs.",
      "- New hires may be created in pending_approval state depending on company settings.",
      "",
    ];
    res.type("text/plain").send(lines.join("\n"));
  });

  router.get("/llms/agent-configuration/:adapterType.txt", async (req, res) => {
    await assertCanRead(req);
    const adapterType = req.params.adapterType as string;
    const adapter = listServerAdapters().find((entry) => entry.type === adapterType);
    if (!adapter) {
      res.status(404).type("text/plain").send(`Unknown adapter type: ${adapterType}`);
      return;
    }
    res
      .type("text/plain")
      .send(
        adapter.agentConfigurationDoc ??
          `# ${adapterType} agent configuration\n\nNo adapter-specific documentation registered.`,
      );
  });

  return router;
}
