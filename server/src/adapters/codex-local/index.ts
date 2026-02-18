import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";

export const codexLocalAdapter: ServerAdapterModule = {
  type: "codex_local",
  execute,
  models: [
    { id: "o4-mini", label: "o4-mini" },
    { id: "o3", label: "o3" },
    { id: "codex-mini-latest", label: "Codex Mini" },
  ],
};
