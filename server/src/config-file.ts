import fs from "node:fs";
import path from "node:path";
import { paperclipConfigSchema, type PaperclipConfig } from "@paperclip/shared";

export function readConfigFile(): PaperclipConfig | null {
  const configPath = process.env.PAPERCLIP_CONFIG
    ? path.resolve(process.env.PAPERCLIP_CONFIG)
    : path.resolve(process.cwd(), ".paperclip/config.json");

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return paperclipConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
