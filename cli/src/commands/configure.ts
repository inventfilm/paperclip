import * as p from "@clack/prompts";
import pc from "picocolors";
import { readConfig, writeConfig, configExists } from "../config/store.js";
import type { PaperclipConfig } from "../config/schema.js";
import { promptDatabase } from "../prompts/database.js";
import { promptLlm } from "../prompts/llm.js";
import { promptLogging } from "../prompts/logging.js";
import { promptServer } from "../prompts/server.js";

type Section = "llm" | "database" | "logging" | "server";

const SECTION_LABELS: Record<Section, string> = {
  llm: "LLM Provider",
  database: "Database",
  logging: "Logging",
  server: "Server",
};

export async function configure(opts: {
  config?: string;
  section?: string;
}): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" paperclip configure ")));

  if (!configExists(opts.config)) {
    p.log.error("No config file found. Run `paperclip onboard` first.");
    p.outro("");
    return;
  }

  const config = readConfig(opts.config);
  if (!config) {
    p.log.error("Could not read config file. Run `paperclip onboard` to recreate.");
    p.outro("");
    return;
  }

  let section: Section | undefined = opts.section as Section | undefined;

  if (section && !SECTION_LABELS[section]) {
    p.log.error(`Unknown section: ${section}. Choose from: ${Object.keys(SECTION_LABELS).join(", ")}`);
    p.outro("");
    return;
  }

  // Section selection loop
  let continueLoop = true;
  while (continueLoop) {
    if (!section) {
      const choice = await p.select({
        message: "Which section do you want to configure?",
        options: Object.entries(SECTION_LABELS).map(([value, label]) => ({
          value: value as Section,
          label,
        })),
      });

      if (p.isCancel(choice)) {
        p.cancel("Configuration cancelled.");
        return;
      }

      section = choice;
    }

    p.log.step(pc.bold(SECTION_LABELS[section]));

    switch (section) {
      case "database":
        config.database = await promptDatabase();
        break;
      case "llm": {
        const llm = await promptLlm();
        if (llm) {
          config.llm = llm;
        } else {
          delete config.llm;
        }
        break;
      }
      case "logging":
        config.logging = await promptLogging();
        break;
      case "server":
        config.server = await promptServer();
        break;
    }

    config.$meta.updatedAt = new Date().toISOString();
    config.$meta.source = "configure";

    writeConfig(config, opts.config);
    p.log.success(`${SECTION_LABELS[section]} configuration updated.`);

    // If section was provided via CLI flag, don't loop
    if (opts.section) {
      continueLoop = false;
    } else {
      const another = await p.confirm({
        message: "Configure another section?",
        initialValue: false,
      });

      if (p.isCancel(another) || !another) {
        continueLoop = false;
      } else {
        section = undefined; // Reset to show picker again
      }
    }
  }

  p.outro("Configuration saved.");
}
