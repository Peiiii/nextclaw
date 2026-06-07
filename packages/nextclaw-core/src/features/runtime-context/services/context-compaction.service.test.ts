import { describe, expect, it } from "vitest";
import { ContextCompactionService } from "./context-compaction.service.js";

function userMessage(id: string, content: string): Record<string, unknown> {
  return {
    role: "user",
    content,
    ncp_message_id: id,
  };
}

describe("ContextCompactionService", () => {
  it("uses the whole non-system model input as the compression source", () => {
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

    expect(plan?.coveredMessages.map((message) => message.ncp_message_id)).toContain("current-user");
    expect(plan?.coveredMessages.map((message) => message.role)).not.toContain("system");
    expect(plan?.messages).toBe(messages);
  });

  it("returns only system plus compressed summary after compaction", async () => {
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
        expect(sourceMessages.map((message) => message.ncp_message_id)).toContain("current-user");
        return "# Compressed Working Context\n\nRecent intent: please continue from here.";
      },
    });

    expect(compacted.messages).toEqual([
      { role: "system", content: "system prompt" },
      {
        role: "user",
        content: "# Compressed Working Context\n\nRecent intent: please continue from here.",
      },
    ]);
    expect(compacted.checkpoint).toMatchObject({
      version: 1,
      status: "compressed",
      summary: "# Compressed Working Context\n\nRecent intent: please continue from here.",
      coveredMessageCount: 13,
      coveredSessionMessageCount: 13,
    });
  });
});
