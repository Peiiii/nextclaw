import { describe, expect, it } from "vitest";
import { fitContextCompactionSummaryInput, selectContextCompactionAttemptMessages } from "@kernel/utils/context-compaction-summary-input.utils.js";

describe("compaction execution evidence", () => {
  it("carries the operation identity together with a terse successful result", () => {
    const input = fitContextCompactionSummaryInput({ maxInputTokens: 15_000, targetSummaryTokens: 4_000, messages: [
      { role: "assistant", content: null, tool_calls: [{ id: "migrate-1", type: "function", function: {
        name: "exec", arguments: '{"cmd":"node migrate-once.cjs"}',
      } }] },
      { role: "tool", tool_call_id: "migrate-1", content: "exit code 0" },
    ] });
    const source = JSON.stringify(input);
    expect(source).toContain("migrate-once.cjs");
    expect(source).toContain("migrate-1");
    expect(source).toContain("exec");
    expect(source).toContain("exit code 0");
  });

  it("keeps middle completion evidence when the transcript exceeds the source cap", () => {
    const messages = Array.from({ length: 24 }, (_, index) => ({ role: "assistant",
      content: `${index === 11 ? "migration-completed" : `step-${index}`} ${"x".repeat(7_000)}`,
      ncp_message_id: `message-${index}`,
    }));
    const input = fitContextCompactionSummaryInput({ messages, maxInputTokens: 15_000, targetSummaryTokens: 4_000 });
    const source = JSON.stringify(input);
    expect(source).toContain("migration-completed");
    for (const message of messages) expect(source).toContain(message.ncp_message_id);
  });

  it("reduces retry text without dropping operation identities or the previous checkpoint", () => {
    const messages = [{ role: "system", content: "# Compressed Working Context\nAlready migrated." },
      ...Array.from({ length: 20 }, (_, index) => ({ role: "tool", tool_call_id: `operation-${index}`,
        content: `Completed ${index}. ${"x".repeat(1_000)}`,
      })),
    ];
    for (const attempt of [2, 3]) {
      const selected = selectContextCompactionAttemptMessages(messages, attempt);
      expect(selected).toHaveLength(messages.length);
      expect(selected[0]?.content).toBe(messages[0]?.content);
      expect(selected.map((message) => message.tool_call_id)).toEqual(messages.map((message) => message.tool_call_id));
    }
  });
});
