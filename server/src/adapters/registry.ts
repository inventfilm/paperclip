import type { ServerAdapterModule } from "./types.js";
import { execute as claudeExecute } from "@paperclip/adapter-claude-local/server";
import { models as claudeModels } from "@paperclip/adapter-claude-local";
import { execute as codexExecute } from "@paperclip/adapter-codex-local/server";
import { models as codexModels } from "@paperclip/adapter-codex-local";
import { processAdapter } from "./process/index.js";
import { httpAdapter } from "./http/index.js";

const claudeLocalAdapter: ServerAdapterModule = {
  type: "claude_local",
  execute: claudeExecute,
  models: claudeModels,
};

const codexLocalAdapter: ServerAdapterModule = {
  type: "codex_local",
  execute: codexExecute,
  models: codexModels,
};

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
