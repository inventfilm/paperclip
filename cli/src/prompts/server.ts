import * as p from "@clack/prompts";
import type { ServerConfig } from "../config/schema.js";

export async function promptServer(): Promise<ServerConfig> {
  const portStr = await p.text({
    message: "Server port",
    defaultValue: "3100",
    placeholder: "3100",
    validate: (val) => {
      const n = Number(val);
      if (isNaN(n) || n < 1 || n > 65535 || !Number.isInteger(n)) {
        return "Must be an integer between 1 and 65535";
      }
    },
  });

  if (p.isCancel(portStr)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  const port = Number(portStr) || 3100;

  const serveUi = await p.confirm({
    message: "Serve the UI from the server?",
    initialValue: false,
  });

  if (p.isCancel(serveUi)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  return { port, serveUi };
}
