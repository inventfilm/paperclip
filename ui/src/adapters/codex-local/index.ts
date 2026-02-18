import type { UIAdapterModule } from "../types";
import { parseCodexStdoutLine } from "./parse-stdout";
import { CodexLocalConfigFields } from "./config-fields";
import { buildCodexLocalConfig } from "./build-config";

export const codexLocalUIAdapter: UIAdapterModule = {
  type: "codex_local",
  label: "Codex (local)",
  parseStdoutLine: parseCodexStdoutLine,
  ConfigFields: CodexLocalConfigFields,
  buildAdapterConfig: buildCodexLocalConfig,
};
