import * as p from "@clack/prompts";
import type { LoggingConfig } from "../config/schema.js";

export async function promptLogging(): Promise<LoggingConfig> {
  const mode = await p.select({
    message: "Logging mode",
    options: [
      { value: "file" as const, label: "File-based logging", hint: "recommended" },
      { value: "cloud" as const, label: "Cloud logging", hint: "coming soon" },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  if (mode === "file") {
    const logDir = await p.text({
      message: "Log directory",
      defaultValue: "./data/logs",
      placeholder: "./data/logs",
    });

    if (p.isCancel(logDir)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }

    return { mode: "file", logDir: logDir || "./data/logs" };
  }

  p.note("Cloud logging is coming soon. Using file-based logging for now.");
  return { mode: "file", logDir: "./data/logs" };
}
