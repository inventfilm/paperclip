import type { CLIAdapterModule } from "../types.js";
import { printClaudeStreamEvent } from "./format-event.js";

export const claudeLocalCLIAdapter: CLIAdapterModule = {
  type: "claude_local",
  formatStdoutEvent: printClaudeStreamEvent,
};
