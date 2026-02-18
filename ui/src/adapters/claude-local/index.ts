import type { UIAdapterModule } from "../types";
import { parseClaudeStdoutLine } from "./parse-stdout";
import { ClaudeLocalConfigFields } from "./config-fields";
import { buildClaudeLocalConfig } from "./build-config";

export const claudeLocalUIAdapter: UIAdapterModule = {
  type: "claude_local",
  label: "Claude Code (local)",
  parseStdoutLine: parseClaudeStdoutLine,
  ConfigFields: ClaudeLocalConfigFields,
  buildAdapterConfig: buildClaudeLocalConfig,
};
