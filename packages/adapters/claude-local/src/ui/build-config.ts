import type { CreateConfigValues } from "@paperclip/adapter-utils";

function parseCommaArgs(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseEnvVars(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    env[key] = value;
  }
  return env;
}

export function buildClaudeLocalConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.cwd) ac.cwd = v.cwd;
  if (v.promptTemplate) ac.promptTemplate = v.promptTemplate;
  if (v.bootstrapPrompt) ac.bootstrapPromptTemplate = v.bootstrapPrompt;
  if (v.model) ac.model = v.model;
  ac.timeoutSec = 0;
  ac.graceSec = 15;
  const env = parseEnvVars(v.envVars);
  if (Object.keys(env).length > 0) ac.env = env;
  ac.maxTurnsPerRun = v.maxTurnsPerRun;
  ac.dangerouslySkipPermissions = v.dangerouslySkipPermissions;
  if (v.command) ac.command = v.command;
  if (v.extraArgs) ac.extraArgs = parseCommaArgs(v.extraArgs);
  return ac;
}
