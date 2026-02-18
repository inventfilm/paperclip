import type { agents, agentRuntimeState } from "@paperclip/db";

export interface UsageSummary {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface AdapterExecutionResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  errorMessage?: string | null;
  usage?: UsageSummary;
  sessionId?: string | null;
  provider?: string | null;
  model?: string | null;
  costUsd?: number | null;
  resultJson?: Record<string, unknown> | null;
  summary?: string | null;
  clearSession?: boolean;
}

export interface AdapterInvocationMeta {
  adapterType: string;
  command: string;
  cwd?: string;
  commandArgs?: string[];
  env?: Record<string, string>;
  prompt?: string;
  context?: Record<string, unknown>;
}

export type AgentRecord = typeof agents.$inferSelect;
export type AgentRuntimeStateRecord = typeof agentRuntimeState.$inferSelect;

export interface AdapterExecutionContext {
  runId: string;
  agent: AgentRecord;
  runtime: AgentRuntimeStateRecord;
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
  onMeta?: (meta: AdapterInvocationMeta) => Promise<void>;
}

export interface ServerAdapterModule {
  type: string;
  execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult>;
  models?: { id: string; label: string }[];
}
