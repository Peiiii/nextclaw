import { createUnavailableNcpAiExecutionMetadata, NcpEventType, type NcpMessage } from "@nextclaw/ncp";
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

const summaryLabels = {
  processedLabel: "已处理",
  failedLabel: "处理失败",
  stoppedLabel: "已停止",
  language: "zh" as const,
};

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
    expect(buildChatMessageProcessSummary({ ...summaryLabels, message })?.label).toBe("已处理 3分钟51秒");
  });

  it("does not invent duration when lifecycle timing is absent", () => {
    expect(
      buildChatMessageProcessSummary({
        ...summaryLabels,
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
        ...summaryLabels,
        language: "en",
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
      ...summaryLabels,
      message: baseAssistantMessage,
      processedLabel: "Processed",
    });
    expect(summary?.label).toBe("Processed");
    expect(summary?.label.toLowerCase()).not.toContain("bash");
    expect(summary?.label.toLowerCase()).not.toContain("read");
  });

  it("keeps deferred history summaries identical to fully loaded messages", () => {
    const summary = buildChatMessageProcessSummary({
      ...summaryLabels,
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
    });

    expect(summary?.label).toBe(
      "Processed",
    );
  });

  it.each([
    [0, "0秒"], [7, "7秒"], [127, "2分钟7秒"],
    [3600, "1小时"], [3720, "1小时2分钟"],
  ])("localizes a %i-second duration without separators", (seconds, expected) => {
    const startedAt = "2026-03-31T10:00:00.000Z";
    const message: NcpMessage = {
      ...baseAssistantMessage,
      lifecycle: { startedAt, endedAt: new Date(Date.parse(startedAt) + seconds * 1000).toISOString() },
    };
    expect(buildChatMessageProcessSummary({ ...summaryLabels, message })?.label).toBe(`已处理 ${expected}`);
  });

  it.each(["pending", "streaming"] as const)("does not label %s messages as processed", (status) => {
    expect(buildChatMessageProcessSummary({
      ...summaryLabels, message: { ...baseAssistantMessage, status },
    })).toBeUndefined();
  });

  it.each([
    ["failed", "处理失败"], ["aborted", "已停止"], ["completed", "已处理"],
  ] as const)("uses the recorded %s outcome", (outcome, expected) => {
    const message: NcpMessage = {
      ...baseAssistantMessage,
      metadata: { ai_execution: createUnavailableNcpAiExecutionMetadata({
        runId: "run-1", runtimeId: "native", model: "test", requestedModel: null, outcome,
      }) },
    };
    expect(buildChatMessageProcessSummary({ ...summaryLabels, message })?.label).toBe(expected);
  });

  it("shows failure for an error message without execution metadata", () => {
    expect(buildChatMessageProcessSummary({
      ...summaryLabels, message: { ...baseAssistantMessage, status: "error" },
    })?.label).toBe("处理失败");
  });
});
