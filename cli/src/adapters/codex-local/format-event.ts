import pc from "picocolors";

export function printCodexStreamEvent(raw: string, _debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    console.log(line);
    return;
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";

  if (type === "thread.started") {
    const threadId = typeof parsed.thread_id === "string" ? parsed.thread_id : "";
    console.log(pc.blue(`Codex thread started${threadId ? ` (session: ${threadId})` : ""}`));
    return;
  }

  if (type === "item.completed") {
    const item =
      typeof parsed.item === "object" && parsed.item !== null && !Array.isArray(parsed.item)
        ? (parsed.item as Record<string, unknown>)
        : null;
    if (item) {
      const itemType = typeof item.type === "string" ? item.type : "";
      if (itemType === "agent_message") {
        const text = typeof item.text === "string" ? item.text : "";
        if (text) console.log(pc.green(`assistant: ${text}`));
      } else if (itemType === "tool_use") {
        const name = typeof item.name === "string" ? item.name : "unknown";
        console.log(pc.yellow(`tool_call: ${name}`));
      }
    }
    return;
  }

  if (type === "turn.completed") {
    const usage =
      typeof parsed.usage === "object" && parsed.usage !== null && !Array.isArray(parsed.usage)
        ? (parsed.usage as Record<string, unknown>)
        : {};
    const input = Number(usage.input_tokens ?? 0);
    const output = Number(usage.output_tokens ?? 0);
    const cached = Number(usage.cached_input_tokens ?? 0);
    console.log(
      pc.blue(`tokens: in=${input} out=${output} cached=${cached}`),
    );
    return;
  }

  console.log(line);
}
