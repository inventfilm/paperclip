import * as p from "@clack/prompts";
import type { AuthConfig, ServerConfig } from "../config/schema.js";

export async function promptServer(): Promise<{ server: ServerConfig; auth: AuthConfig }> {
  const deploymentModeSelection = await p.select({
    message: "Deployment mode",
    options: [
      {
        value: "local_trusted",
        label: "Local trusted",
        hint: "Easiest for local setup (no login, localhost-only)",
      },
      {
        value: "authenticated",
        label: "Authenticated",
        hint: "Login required; use for private network or public hosting",
      },
    ],
    initialValue: "local_trusted",
  });

  if (p.isCancel(deploymentModeSelection)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  const deploymentMode = deploymentModeSelection as ServerConfig["deploymentMode"];
  let exposure: ServerConfig["exposure"] = "private";
  if (deploymentMode === "authenticated") {
    const exposureSelection = await p.select({
      message: "Exposure profile",
      options: [
        {
          value: "private",
          label: "Private network",
          hint: "Private access (for example Tailscale), lower setup friction",
        },
        {
          value: "public",
          label: "Public internet",
          hint: "Internet-facing deployment with stricter requirements",
        },
      ],
      initialValue: "private",
    });
    if (p.isCancel(exposureSelection)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    exposure = exposureSelection as ServerConfig["exposure"];
  }

  const hostDefault = deploymentMode === "local_trusted" ? "127.0.0.1" : "0.0.0.0";
  const hostStr = await p.text({
    message: "Bind host",
    defaultValue: hostDefault,
    placeholder: hostDefault,
    validate: (val) => {
      if (!val.trim()) return "Host is required";
    },
  });

  if (p.isCancel(hostStr)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

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
  let auth: AuthConfig = { baseUrlMode: "auto" };
  if (deploymentMode === "authenticated" && exposure === "public") {
    const urlInput = await p.text({
      message: "Public base URL",
      placeholder: "https://paperclip.example.com",
      validate: (val) => {
        const candidate = val.trim();
        if (!candidate) return "Public base URL is required for public exposure";
        try {
          const url = new URL(candidate);
          if (url.protocol !== "http:" && url.protocol !== "https:") {
            return "URL must start with http:// or https://";
          }
          return;
        } catch {
          return "Enter a valid URL";
        }
      },
    });
    if (p.isCancel(urlInput)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    auth = {
      baseUrlMode: "explicit",
      publicBaseUrl: urlInput.trim().replace(/\/+$/, ""),
    };
  }

  return {
    server: { deploymentMode, exposure, host: hostStr.trim(), port, serveUi: true },
    auth,
  };
}
