import type { NcpMessage } from "@nextclaw/ncp";
import { describe, expect, it } from "vitest";
import { buildChatMessageProcessSummary } from "@/features/chat/features/message/utils/chat-message-process-summary.utils";

const baseAssistantMessage = {
  id: "assistant-1",
  sessionId: "session-1",
  role: "assistant",
  status: "final",
  timestamp: "2026-03-31T10:03:51.000Z",
  parts: [
    {
      type: "reasoning",
      text: "Inspecting current state.",
    },
    {
      type: "tool-invocation",
      toolCallId: "tool-1",
      toolName: "exec_command",
      state: "result",
      args: '{"cmd":"git status"}',
      result: "clean",
    },
    {
      type: "text",
      text: "Done.",
    },
  ],
} satisfies NcpMessage;

describe("buildChatMessageProcessSummary", () => {
  it("does not invent duration when lifecycle timing is absent", () => {
    expect(
      buildChatMessageProcessSummary({
        message: baseAssistantMessage,
        processedLabel: "Processed",
      }),
    ).toEqual({
      label: "Processed",
    });
  });

  it("derives duration from lifecycle startedAt and endedAt", () => {
    expect(
      buildChatMessageProcessSummary({
        message: {
          ...baseAssistantMessage,
          lifecycle: {
            startedAt: "2026-03-31T10:00:00.000Z",
            endedAt: "2026-03-31T10:03:51.000Z",
          },
        },
        processedLabel: "Processed",
      }),
    ).toEqual({
      label: "Processed 3m 51s",
    });
  });

  it("stays free of tool-activity semantics", () => {
    const summary = buildChatMessageProcessSummary({
      message: baseAssistantMessage,
      processedLabel: "Processed",
    });
    expect(summary?.label).toBe("Processed");
    expect(summary?.label.toLowerCase()).not.toContain("bash");
    expect(summary?.label.toLowerCase()).not.toContain("read");
  });
});
