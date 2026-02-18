import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";

export const processAdapter: ServerAdapterModule = {
  type: "process",
  execute,
  models: [],
};
