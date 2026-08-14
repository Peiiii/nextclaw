import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state.manager.js";

async function startToolCall(
  manager: DefaultNcpAgentConversationStateManager,
  toolCallId = "tool-timing",
  messageId = "assistant-timing",
): Promise<void> {
  await manager.dispatch({
    type: NcpEventType.MessageToolCallStart,
    payload: {
      sessionId: "session-timing",
      messageId,
      toolCallId,
      toolName: "exec",
    },
  });
  await manager.dispatch({
    type: NcpEventType.MessageToolCallEnd,
    payload: { sessionId: "session-timing", toolCallId },
  });
}

describe("DefaultNcpAgentConversationStateManager tool execution timing", () => {
  it("keeps progress running and freezes the strongest terminal timing", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    await startToolCall(manager);
    expect(
      (
        manager.getSnapshot().streamingMessage?.parts[0] as
          | { execution?: unknown }
          | undefined
      )?.execution,
    ).toBeUndefined();

    await manager.dispatch({
      occurredAt: "2026-08-14T00:00:01.000Z",
      type: NcpEventType.MessageToolExecutionStarted,
      payload: {
        sessionId: "session-timing",
        messageId: "assistant-timing",
        toolCallId: "tool-timing",
      },
    });
    await manager.dispatch({
      occurredAt: "2026-08-14T00:00:02.000Z",
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-timing",
        toolCallId: "tool-timing",
        content: { status: "in_progress" },
        final: false,
      },
    });
    expect(manager.getSnapshot().streamingMessage?.parts[0]).toMatchObject({
      state: "call",
      result: { status: "in_progress" },
      execution: { startedAt: "2026-08-14T00:00:01.000Z" },
    });

    await manager.dispatch({
      occurredAt: "2026-08-14T00:00:04.000Z",
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-timing",
        toolCallId: "tool-timing",
        content: { ok: true },
        execution: {
          startedAt: "2026-08-14T00:00:01.000Z",
          endedAt: "2026-08-14T00:00:03.500Z",
          durationMs: 2495,
        },
      },
    });
    await manager.dispatch({
      occurredAt: "2026-08-14T00:00:09.000Z",
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-timing",
        toolCallId: "tool-timing",
        content: { ok: true },
      },
    });
    await manager.dispatch({
      occurredAt: "2026-08-14T00:00:00.000Z",
      type: NcpEventType.MessageToolExecutionStarted,
      payload: { sessionId: "session-timing", toolCallId: "tool-timing" },
    });

    expect(manager.getSnapshot().streamingMessage?.parts[0]).toMatchObject({
      state: "result",
      execution: {
        startedAt: "2026-08-14T00:00:01.000Z",
        endedAt: "2026-08-14T00:00:03.500Z",
        durationMs: 2495,
      },
    });
  });

  it("ends an actually started command when the run is aborted", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    await startToolCall(manager, "tool-abort-timing", "assistant-abort-timing");
    await manager.dispatch({
      occurredAt: "2026-08-14T00:00:01.000Z",
      type: NcpEventType.MessageToolExecutionStarted,
      payload: { sessionId: "session-timing", toolCallId: "tool-abort-timing" },
    });
    await manager.dispatch({
      occurredAt: "2026-08-14T00:00:05.000Z",
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: "session-timing",
        messageId: "assistant-abort-timing",
      },
    });

    expect(manager.getSnapshot().messages[0]?.parts[0]).toMatchObject({
      state: "cancelled",
      execution: {
        startedAt: "2026-08-14T00:00:01.000Z",
        endedAt: "2026-08-14T00:00:05.000Z",
      },
    });
  });

  it("keeps parallel command timing isolated by toolCallId", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    await startToolCall(manager, "tool-parallel-a");
    await startToolCall(manager, "tool-parallel-b");
    await manager.dispatch({
      occurredAt: "2026-08-14T00:00:01.000Z",
      type: NcpEventType.MessageToolExecutionStarted,
      payload: { sessionId: "session-timing", toolCallId: "tool-parallel-a" },
    });
    await manager.dispatch({
      occurredAt: "2026-08-14T00:00:02.000Z",
      type: NcpEventType.MessageToolExecutionStarted,
      payload: { sessionId: "session-timing", toolCallId: "tool-parallel-b" },
    });
    await manager.dispatch({
      occurredAt: "2026-08-14T00:00:03.000Z",
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-timing",
        toolCallId: "tool-parallel-a",
        content: { ok: true },
        execution: { durationMs: 2000, endedAt: "2026-08-14T00:00:03.000Z" },
      },
    });

    expect(manager.getSnapshot().streamingMessage?.parts).toMatchObject([
      {
        toolCallId: "tool-parallel-a",
        state: "result",
        execution: {
          startedAt: "2026-08-14T00:00:01.000Z",
          endedAt: "2026-08-14T00:00:03.000Z",
          durationMs: 2000,
        },
      },
      {
        toolCallId: "tool-parallel-b",
        state: "call",
        execution: { startedAt: "2026-08-14T00:00:02.000Z" },
      },
    ]);
  });

  it("clones nested timing during hydration", () => {
    const execution = { startedAt: "2026-08-14T00:00:01.000Z" };
    const message: NcpMessage = {
      id: "assistant-clone-timing",
      sessionId: "session-timing",
      role: "assistant",
      status: "streaming",
      timestamp: "2026-08-14T00:00:00.000Z",
      parts: [
        {
          type: "tool-invocation",
          toolCallId: "tool-clone-timing",
          toolName: "exec",
          state: "call",
          execution,
        },
      ],
    };
    const manager = new DefaultNcpAgentConversationStateManager();
    manager.hydrate({ sessionId: "session-timing", messages: [message] });
    execution.startedAt = "2026-08-14T00:00:09.000Z";
    expect(manager.getSnapshot().messages[0]?.parts[0]).toMatchObject({
      execution: { startedAt: "2026-08-14T00:00:01.000Z" },
    });
  });
});
