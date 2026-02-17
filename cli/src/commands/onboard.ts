import * as p from "@clack/prompts";
import pc from "picocolors";
import { configExists, readConfig, writeConfig } from "../config/store.js";
import type { PaperclipConfig } from "../config/schema.js";
import { promptDatabase } from "../prompts/database.js";
import { promptLlm } from "../prompts/llm.js";
import { promptLogging } from "../prompts/logging.js";
import { promptServer } from "../prompts/server.js";

export async function onboard(opts: { config?: string }): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" paperclip onboard ")));

  // Check for existing config
  if (configExists(opts.config)) {
    const existing = readConfig(opts.config);
    if (existing) {
      const overwrite = await p.confirm({
        message: "A config file already exists. Overwrite it?",
        initialValue: false,
      });

      if (p.isCancel(overwrite) || !overwrite) {
        p.cancel("Keeping existing configuration.");
        return;
      }
    }
  }

  // Database
  p.log.step(pc.bold("Database"));
  const database = await promptDatabase();

  if (database.mode === "postgres" && database.connectionString) {
    const s = p.spinner();
    s.start("Testing database connection...");
    try {
      const { createDb } = await import("@paperclip/db");
      const db = createDb(database.connectionString);
      await db.execute("SELECT 1");
      s.stop("Database connection successful");
    } catch (err) {
      s.stop(pc.yellow("Could not connect to database — you can fix this later with `paperclip doctor`"));
    }
  }

  // LLM
  p.log.step(pc.bold("LLM Provider"));
  const llm = await promptLlm();

  if (llm?.apiKey) {
    const s = p.spinner();
    s.start("Validating API key...");
    try {
      if (llm.provider === "claude") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": llm.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        if (res.ok || res.status === 400) {
          s.stop("API key is valid");
        } else if (res.status === 401) {
          s.stop(pc.yellow("API key appears invalid — you can update it later"));
        } else {
          s.stop(pc.yellow("Could not validate API key — continuing anyway"));
        }
      } else {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${llm.apiKey}` },
        });
        if (res.ok) {
          s.stop("API key is valid");
        } else if (res.status === 401) {
          s.stop(pc.yellow("API key appears invalid — you can update it later"));
        } else {
          s.stop(pc.yellow("Could not validate API key — continuing anyway"));
        }
      }
    } catch {
      s.stop(pc.yellow("Could not reach API — continuing anyway"));
    }
  }

  // Logging
  p.log.step(pc.bold("Logging"));
  const logging = await promptLogging();

  // Server
  p.log.step(pc.bold("Server"));
  const server = await promptServer();

  // Assemble and write config
  const config: PaperclipConfig = {
    $meta: {
      version: 1,
      updatedAt: new Date().toISOString(),
      source: "onboard",
    },
    ...(llm && { llm }),
    database,
    logging,
    server,
  };

  writeConfig(config, opts.config);

  p.note(
    [
      `Database: ${database.mode}`,
      llm ? `LLM: ${llm.provider}` : "LLM: not configured",
      `Logging: ${logging.mode} → ${logging.logDir}`,
      `Server: port ${server.port}`,
    ].join("\n"),
    "Configuration saved",
  );

  p.log.info(`Run ${pc.cyan("pnpm paperclip doctor")} to verify your setup.`);
  p.outro("You're all set!");
}
