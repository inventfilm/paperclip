import type { TranscriptEntry } from "@paperclip/adapter-utils";

export function parseOpenClawStdoutLine(line: string, ts: string): TranscriptEntry[] {
  return [{ kind: "stdout", ts, text: line }];
}
