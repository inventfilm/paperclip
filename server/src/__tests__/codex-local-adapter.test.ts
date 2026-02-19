import { describe, expect, it } from "vitest";
import { isCodexUnknownSessionError, parseCodexJsonl } from "@paperclip/adapter-codex-local/server";

describe("codex_local parser", () => {
  it("extracts session, summary, usage, and terminal error message", () => {
    const stdout = [
      JSON.stringify({ type: "thread.started", thread_id: "thread-123" }),
      JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "hello" } }),
      JSON.stringify({ type: "turn.completed", usage: { input_tokens: 10, cached_input_tokens: 2, output_tokens: 4 } }),
      JSON.stringify({ type: "turn.failed", error: { message: "model access denied" } }),
    ].join("\n");

    const parsed = parseCodexJsonl(stdout);
    expect(parsed.sessionId).toBe("thread-123");
    expect(parsed.summary).toBe("hello");
    expect(parsed.usage).toEqual({
      inputTokens: 10,
      cachedInputTokens: 2,
      outputTokens: 4,
    });
    expect(parsed.errorMessage).toBe("model access denied");
  });
});

describe("codex_local stale session detection", () => {
  it("treats missing rollout path as an unknown session error", () => {
    const stderr =
      "2026-02-19T19:58:53.281939Z ERROR codex_core::rollout::list: state db missing rollout path for thread 019c775d-967c-7ef1-acc7-e396dc2c87cc";

    expect(isCodexUnknownSessionError("", stderr)).toBe(true);
  });
});
