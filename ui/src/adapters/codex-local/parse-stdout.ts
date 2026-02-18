import type { TranscriptEntry } from "../types";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseCodexStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    return [{ kind: "stdout", ts, text: line }];
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";

  if (type === "thread.started") {
    const threadId = typeof parsed.thread_id === "string" ? parsed.thread_id : "";
    return [{
      kind: "init",
      ts,
      model: "codex",
      sessionId: threadId,
    }];
  }

  if (type === "item.completed") {
    const item = asRecord(parsed.item);
    if (item) {
      const itemType = typeof item.type === "string" ? item.type : "";
      if (itemType === "agent_message") {
        const text = typeof item.text === "string" ? item.text : "";
        if (text) return [{ kind: "assistant", ts, text }];
      }
      if (itemType === "tool_use") {
        return [{
          kind: "tool_call",
          ts,
          name: typeof item.name === "string" ? item.name : "unknown",
          input: item.input ?? {},
        }];
      }
    }
  }

  if (type === "turn.completed") {
    const usage = asRecord(parsed.usage) ?? {};
    const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
    const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
    const cachedTokens = typeof usage.cached_input_tokens === "number" ? usage.cached_input_tokens : 0;
    return [{
      kind: "result",
      ts,
      text: "",
      inputTokens,
      outputTokens,
      cachedTokens,
      costUsd: 0,
      subtype: "",
      isError: false,
      errors: [],
    }];
  }

  return [{ kind: "stdout", ts, text: line }];
}
