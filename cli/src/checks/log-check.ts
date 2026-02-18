import fs from "node:fs";
import path from "node:path";
import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";

function resolveConfigRelativePath(value: string, configPath?: string): string {
  if (path.isAbsolute(value)) return value;
  const candidates = [path.resolve(value)];
  if (configPath) {
    candidates.unshift(path.resolve(path.dirname(configPath), "..", "server", value));
    candidates.unshift(path.resolve(path.dirname(configPath), value));
  }
  candidates.push(path.resolve(process.cwd(), "server", value));
  const uniqueCandidates = Array.from(new Set(candidates));
  return uniqueCandidates.find((candidate) => fs.existsSync(candidate)) ?? uniqueCandidates[0];
}

export function logCheck(config: PaperclipConfig, configPath?: string): CheckResult {
  const logDir = resolveConfigRelativePath(config.logging.logDir, configPath);
  const reportedDir = logDir;

  if (!fs.existsSync(logDir)) {
    return {
      name: "Log directory",
      status: "warn",
      message: `Log directory does not exist: ${reportedDir}`,
      canRepair: true,
      repair: () => {
        fs.mkdirSync(reportedDir, { recursive: true });
      },
    };
  }

  try {
    fs.accessSync(reportedDir, fs.constants.W_OK);
    return {
      name: "Log directory",
      status: "pass",
      message: `Log directory is writable: ${reportedDir}`,
    };
  } catch {
    return {
      name: "Log directory",
      status: "fail",
      message: `Log directory is not writable: ${logDir}`,
      canRepair: false,
      repairHint: "Check file permissions on the log directory",
    };
  }
}
