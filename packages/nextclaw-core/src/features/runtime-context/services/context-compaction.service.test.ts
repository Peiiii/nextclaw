import { describe, expect, it, vi } from "vitest";
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

  it("covers the full conversation for a mid-run compaction", () => {
    const service = new ContextCompactionService();
    const messages = [
      { role: "system", content: "system prompt" },
      assistantMessage("active-assistant", "tool result ".repeat(1_000)),
    ];

    const plan = service.prepareForModelInput({
      messages,
      contextTokens: 1_000,
      compactionThresholdTokens: 20,
      retainLatestMessage: false,
    });

    expect(plan?.coveredMessages.map((message) => message.ncp_message_id)).toEqual([
      "active-assistant",
    ]);
    expect(plan?.retainedMessages).toEqual([]);
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
      retainedMessageIds: ["current-user"],
      summary: "# Compressed Working Context\n\nRecent intent: please continue from here.",
      coveredMessageCount: 12,
      coveredSessionMessageCount: 12,
    });
  });

  it("preserves real user messages alongside the generated summary", async () => {
    const service = new ContextCompactionService();
    const messages = [
      { role: "system", content: "system prompt" },
      userMessage("earlier-user", "keep this exact constraint"),
      assistantMessage("earlier-assistant", "acknowledged ".repeat(100)),
      userMessage("latest-user", "and keep this correction verbatim"),
      assistantMessage("active-assistant", "tool result ".repeat(100)),
    ];
    const plan = service.prepareForModelInput({
      messages,
      contextTokens: 1_000,
      compactionThresholdTokens: 20,
      projectedTokenLimit: 800,
      preservableUserMessageIds: ["earlier-user", "latest-user"],
      retainLatestMessage: false,
    });

    const compacted = await service.compactPreparedForModelInput({
      contextTokens: 1_000,
      now: new Date("2026-08-08T00:00:00.000Z"),
      plan: plan!,
      generateSummary: async () => "# Compressed Working Context\n\nThe task continues.",
    });

    expect(compacted.checkpoint?.preservedUserMessageIds).toEqual([
      "earlier-user",
      "latest-user",
    ]);
    expect(compacted.messages).toEqual([
      { role: "system", content: "system prompt" },
      {
        role: "user",
        content: "# Compressed Working Context\n\nThe task continues.",
      },
      userMessage("earlier-user", "keep this exact constraint"),
      userMessage("latest-user", "and keep this correction verbatim"),
    ]);
  });

  it("selects newest user messages first and truncates the oldest selected boundary", async () => {
    const service = new ContextCompactionService();
    const messages = [
      { role: "system", content: "system" },
      userMessage("oldest-user", `OLDEST_HEAD ${"x".repeat(3_000)} OLDEST_TAIL`),
      assistantMessage("assistant", "ack"),
      userMessage("newest-user", "NEWEST_EXACT_CONSTRAINT"),
    ];
    const plan = service.prepareForModelInput({
      messages,
      contextTokens: 1_000,
      compactionThresholdTokens: 20,
      projectedTokenLimit: 380,
      preservableUserMessageIds: ["oldest-user", "newest-user"],
      retainLatestMessage: false,
    });

    const compacted = await service.compactPreparedForModelInput({
      contextTokens: 1_000,
      now: new Date("2026-08-08T00:00:00.000Z"),
      plan: plan!,
      generateSummary: async () => "SUMMARY",
    });

    expect(compacted.checkpoint?.preservedUserMessageIds).toEqual([
      "oldest-user",
      "newest-user",
    ]);
    expect(compacted.checkpoint?.truncatedPreservedUserMessage).toMatchObject({
      messageId: "oldest-user",
      text: expect.stringContaining("tokens truncated"),
    });
    expect(compacted.checkpoint?.truncatedPreservedUserMessage?.text).toContain("OLDEST_HEAD");
    expect(compacted.checkpoint?.truncatedPreservedUserMessage?.text).toContain("OLDEST_TAIL");
    expect(compacted.messages.at(-1)).toEqual(
      userMessage("newest-user", "NEWEST_EXACT_CONSTRAINT"),
    );
    expect(compacted.checkpoint?.projectedEstimatedTokens).toBeLessThanOrEqual(380);
  });

  it("caps preserved user history at the Codex-aligned 20K token budget", async () => {
    const service = new ContextCompactionService();
    const messages = [
      { role: "system", content: "system" },
      userMessage("oversized-user", `USER_HEAD ${"x".repeat(100_000)} USER_TAIL`),
      assistantMessage("assistant", "ack"),
    ];
    const plan = service.prepareForModelInput({
      messages,
      contextTokens: 100_000,
      compactionThresholdTokens: 20,
      projectedTokenLimit: 80_000,
      preservableUserMessageIds: ["oversized-user"],
      retainLatestMessage: false,
    });

    const compacted = await service.compactPreparedForModelInput({
      contextTokens: 100_000,
      now: new Date("2026-08-08T00:00:00.000Z"),
      plan: plan!,
      generateSummary: async () => "SUMMARY",
    });

    expect(compacted.checkpoint?.preservedUserMessageIds).toEqual(["oversized-user"]);
    expect(compacted.checkpoint?.truncatedPreservedUserMessage?.text).toContain(
      "tokens truncated",
    );
    expect(compacted.checkpoint?.projectedEstimatedTokens).toBeGreaterThan(19_000);
    expect(compacted.checkpoint?.projectedEstimatedTokens).toBeLessThanOrEqual(20_050);
  });

  it("uses the full summary completion headroom for reasoning providers", async () => {
    const service = new ContextCompactionService();
    const plan = service.prepareForModelInput({
      messages: [
        { role: "system", content: "system" },
        assistantMessage("covered-assistant", "tool result ".repeat(12_000)),
      ],
      contextTokens: 35_000,
      compactionThresholdTokens: 20,
      fixedInputTokens: 25_802,
      projectedTokenLimit: 28_000,
      retainLatestMessage: false,
    });

    await service.compactPreparedForModelInput({
      contextTokens: 35_000,
      plan: plan!,
      generateSummary: async ({ maxInputTokens, maxTokens, targetSummaryTokens }) => {
        expect(targetSummaryTokens).toBeGreaterThanOrEqual(256);
        expect(maxTokens).toBe(8_000);
        expect(maxInputTokens + maxTokens).toBe(35_000);
        return "# Compressed Working Context\n\n## Continuation Contract\nContinue.";
      },
    });
  });

});

describe("ContextCompactionService final-fit failures", () => {
  it("fails before summary generation when fixed input leaves no usable summary budget", async () => {
    const service = new ContextCompactionService();
    const plan = service.prepareForModelInput({
      messages: [
        { role: "system", content: "system" },
        userMessage("old-user", "old request ".repeat(100)),
        userMessage("current-user", "continue"),
      ],
      contextTokens: 1_000,
      compactionThresholdTokens: 20,
      fixedInputTokens: 700,
      projectedTokenLimit: 800,
    });
    const generateSummary = vi.fn(async () => "SUMMARY");

    await expect(service.compactPreparedForModelInput({
      contextTokens: 1_000,
      plan: plan!,
      generateSummary,
    })).rejects.toThrow("cannot fit a usable summary");
    expect(generateSummary).not.toHaveBeenCalled();
  });

  it("rejects an oversized generated summary before installing a checkpoint", async () => {
    const service = new ContextCompactionService();
    const plan = service.prepareForModelInput({
      messages: [
        { role: "system", content: "system" },
        userMessage("old-user", "old request ".repeat(100)),
        userMessage("current-user", "continue"),
      ],
      contextTokens: 1_000,
      compactionThresholdTokens: 20,
      projectedTokenLimit: 600,
    });

    await expect(service.compactPreparedForModelInput({
      contextTokens: 1_000,
      plan: plan!,
      generateSummary: async ({ maxTokens }) => {
        expect(maxTokens).toBeLessThan(600);
        return "oversized ".repeat(1_000);
      },
    })).rejects.toThrow("output does not fit");
  });
});
