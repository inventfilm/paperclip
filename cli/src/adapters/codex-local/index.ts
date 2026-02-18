import type { CLIAdapterModule } from "../types.js";
import { printCodexStreamEvent } from "./format-event.js";

export const codexLocalCLIAdapter: CLIAdapterModule = {
  type: "codex_local",
  formatStdoutEvent: printCodexStreamEvent,
};
