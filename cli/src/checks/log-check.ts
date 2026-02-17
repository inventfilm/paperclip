import fs from "node:fs";
import path from "node:path";
import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";

export function logCheck(config: PaperclipConfig): CheckResult {
  const logDir = path.resolve(config.logging.logDir);

  if (!fs.existsSync(logDir)) {
    return {
      name: "Log directory",
      status: "warn",
      message: `Log directory does not exist: ${logDir}`,
      canRepair: true,
      repair: () => {
        fs.mkdirSync(logDir, { recursive: true });
      },
    };
  }

  try {
    fs.accessSync(logDir, fs.constants.W_OK);
    return {
      name: "Log directory",
      status: "pass",
      message: `Log directory is writable: ${logDir}`,
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
