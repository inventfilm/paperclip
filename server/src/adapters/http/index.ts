import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";

export const httpAdapter: ServerAdapterModule = {
  type: "http",
  execute,
  models: [],
};
