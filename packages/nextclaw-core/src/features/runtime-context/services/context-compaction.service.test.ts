import { describe, expect, it } from "vitest";
import { ContextCompactionService } from "./context-compaction.service.js";

function userMessage(id: string, content: string): Record<string, unknown> {
  return {
    role: "user",
    content,
    ncp_message_id: id,
  };
}

function assistantMessage(id: string, content: string): Record<string, unknown> {
  return {
    role: "assistant",
    content,
    ncp_message_id: id,
  };
}

describe("ContextCompactionService", () => {
  it("keeps the latest raw tail out of the compression source", () => {
    const service = new ContextCompactionService();
    const messages = [
      { role: "system", content: "system prompt" },
      ...Array.from({ length: 12 }, (_, index) => userMessage(`old-${index}`, `old ${index}`)),
      userMessage("current-user", "please continue from here"),
    ];

    const plan = service.prepareForModelInput({
      messages,
      contextTokens: 1_000,
      compactionThresholdTokens: 20,
    });

    expect(plan?.coveredMessages.map((message) => message.ncp_message_id)).not.toContain("current-user");
    expect(plan?.retainedMessages.map((message) => message.ncp_message_id)).toContain("current-user");
    expect(plan?.coveredMessages.map((message) => message.role)).not.toContain("system");
    expect(plan?.messages).toBe(messages);
  });

  it("compacts a short overloaded conversation and covers the previous large reply", () => {
    const service = new ContextCompactionService();
    const messages = [
      { role: "system", content: "context ".repeat(4_000) },
      userMessage("hello", "hello"),
      assistantMessage("intro", "intro"),
      userMessage("write-novel", "write a novel"),
      assistantMessage("large-previous-reply", "chapter ".repeat(3_000)),
      userMessage("current-user", "hello again"),
    ];

    const plan = service.prepareForModelInput({
      messages,
      contextTokens: 10_000,
      compactionThresholdTokens: 8_000,
    });

    expect(plan).not.toBeNull();
    expect(plan?.retainedMessages.map((message) => message.ncp_message_id)).toEqual(["current-user"]);
    expect(plan?.coveredMessages.map((message) => message.ncp_message_id)).toContain("large-previous-reply");
  });

  it("returns system plus compressed summary and retained tail after compaction", async () => {
    const service = new ContextCompactionService();
    const messages = [
      { role: "system", content: "system prompt" },
      ...Array.from({ length: 12 }, (_, index) => userMessage(`old-${index}`, `old ${index}`)),
      userMessage("current-user", "please continue from here"),
    ];
    const plan = service.prepareForModelInput({
      messages,
      contextTokens: 1_000,
      compactionThresholdTokens: 20,
    });

    const compacted = await service.compactPreparedForModelInput({
      contextTokens: 1_000,
      now: new Date("2026-06-07T00:00:00.000Z"),
      plan: plan!,
      generateSummary: async ({ messages: sourceMessages }) => {
        expect(sourceMessages.map((message) => message.ncp_message_id)).not.toContain("current-user");
        return "# Compressed Working Context\n\nRecent intent: please continue from here.";
      },
    });

    expect(compacted.messages).toEqual([
      { role: "system", content: "system prompt" },
      {
        role: "user",
        content: "# Compressed Working Context\n\nRecent intent: please continue from here.",
      },
      userMessage("current-user", "please continue from here"),
    ]);
    expect(compacted.checkpoint).toMatchObject({
      version: 1,
      status: "compressed",
      coveredUntil: "2026-06-07T00:00:00.000Z",
      summary: "# Compressed Working Context\n\nRecent intent: please continue from here.",
      coveredMessageCount: 12,
      coveredSessionMessageCount: 12,
    });
  });
});
