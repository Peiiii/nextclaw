import { describe, expect, it } from "vitest";
import type { NcpMessage, NcpMessagePart } from "@nextclaw/ncp";
import { MODEL_ROUND_PART_OFFSETS, ncpMessageToOpenAiMessages } from "../runtime/utils/message-converter.utils.js";

const tool = (id: string): NcpMessagePart => ({
  type: "tool-invocation", toolCallId: id, toolName: "read_file", state: "result",
  args: { path: id }, result: `contents of ${id}`,
});
const message = (parts: NcpMessagePart[], offsets?: number[]): NcpMessage => ({
  id: "assistant", sessionId: "session", role: "assistant", status: "final",
  timestamp: "2026-09-07T00:00:00Z", parts,
  ...(offsets ? { metadata: { [MODEL_ROUND_PART_OFFSETS]: offsets } } : {}),
});

describe("model round history", () => {
  it("keeps previous wire messages unchanged after serial tool rounds and reload", () => {
    const parts: NcpMessagePart[] = [{ type: "reasoning", text: "look up first" }, tool("a")];
    const first = ncpMessageToOpenAiMessages(message(parts));
    const next = message([...parts, { type: "reasoning", text: "look up second" }, tool("b")], [2]);
    const second = ncpMessageToOpenAiMessages(next);
    expect(second.slice(0, first.length)).toEqual(first);
    const final = message([...next.parts, { type: "text", text: "done" }], [2, 4]);
    const restored = ncpMessageToOpenAiMessages(JSON.parse(JSON.stringify(final)));
    expect(restored.slice(0, second.length)).toEqual(second);
    expect(restored.at(-1)).toEqual({ role: "assistant", content: "done" });
    expect(restored.map((entry) => entry.role)).toEqual(["assistant", "tool", "assistant", "tool", "assistant"]);
  });

  it("distinguishes parallel tools from consecutive tool-only rounds", () => {
    const first = ncpMessageToOpenAiMessages(message([tool("a"), tool("b")], [2]));
    expect(first[0]?.tool_calls).toHaveLength(2);
    const next = ncpMessageToOpenAiMessages(message([tool("a"), tool("b"), tool("c")], [2]));
    expect(next.slice(0, first.length)).toEqual(first);
    expect(next[3]?.tool_calls).toHaveLength(1);
    expect(next[4]?.tool_call_id).toBe("c");
  });

  it("does not guess model round boundaries in existing persisted messages", () => {
    const result = ncpMessageToOpenAiMessages(message([tool("a"), tool("b")]));
    expect(result[0]?.tool_calls).toHaveLength(2);
  });

  it.each([[0], [3], [1, 1], [-1], [0.5]])("rejects corrupt explicit offsets %j", (...offsets) => {
    expect(() => ncpMessageToOpenAiMessages(message([tool("a"), tool("b")], offsets))).toThrow("Invalid assistant");
  });
});
