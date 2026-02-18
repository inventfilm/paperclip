import type { ServerAdapterModule } from "./types.js";
import { claudeLocalAdapter } from "./claude-local/index.js";
import { codexLocalAdapter } from "./codex-local/index.js";
import { processAdapter } from "./process/index.js";
import { httpAdapter } from "./http/index.js";

const adaptersByType = new Map<string, ServerAdapterModule>(
  [claudeLocalAdapter, codexLocalAdapter, processAdapter, httpAdapter].map((a) => [a.type, a]),
);

export function getServerAdapter(type: string): ServerAdapterModule {
  const adapter = adaptersByType.get(type);
  if (!adapter) {
    // Fall back to process adapter for unknown types
    return processAdapter;
  }
  return adapter;
}

export function listAdapterModels(type: string): { id: string; label: string }[] {
  return adaptersByType.get(type)?.models ?? [];
}
