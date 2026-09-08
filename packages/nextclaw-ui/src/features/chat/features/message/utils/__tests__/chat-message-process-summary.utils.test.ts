import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
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
  it("shows elapsed time from the real completed-message then run-finished event sequence", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    await manager.dispatchBatch([
      { type: NcpEventType.RunStarted, payload: { sessionId: "session-1", runId: "run-1" } },
      { type: NcpEventType.MessageCompleted, payload: { sessionId: "session-1", message: baseAssistantMessage } },
      {
        type: NcpEventType.RunFinished,
        payload: {
          sessionId: "session-1", runId: "run-1", messageId: baseAssistantMessage.id,
          startedAt: "2026-03-31T10:00:00.000Z", endedAt: "2026-03-31T10:03:51.000Z",
        },
      },
    ]);
    const message = manager.getSnapshot().messages[0]!;
    expect(buildChatMessageProcessSummary({ message, processedLabel: "已处理" })?.label).toBe("已处理 3m 51s");
  });

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

  it("shows the bounded aggregate for a deferred history payload", () => {
    const summary = buildChatMessageProcessSummary({
      message: {
        ...baseAssistantMessage,
        metadata: {
          nextclawUiHistoryToolPayloadSummary: {
            toolCallCount: 500,
            toolNames: ["exec_command", "read_file"],
          },
        },
      },
      processedLabel: "Processed",
      formatDeferredToolSummary: (count, names) =>
        `${count} tool calls · ${names.join(", ")}`,
    });

    expect(summary?.label).toBe(
      "Processed · 500 tool calls · exec_command, read_file",
    );
  });
});
