import { describe, expect, it, vi } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state.manager.js";

describe("DefaultNcpAgentConversationStateManager batching", () => {
  it("coalesces batched events into a single subscriber notification", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    const listener = vi.fn();

    manager.subscribe(listener);

    await manager.dispatchBatch([
      {
        type: NcpEventType.MessageToolCallStart,
        payload: {
          sessionId: "session-1",
          messageId: "assistant-batch-1",
          toolCallId: "tool-write-1",
          toolName: "write_file",
        },
      },
      {
        type: NcpEventType.MessageToolCallArgsDelta,
        payload: {
          sessionId: "session-1",
          messageId: "assistant-batch-1",
          toolCallId: "tool-write-1",
          delta: "{\"path\":\"src/app.ts\",",
        },
      },
      {
        type: NcpEventType.MessageToolCallArgsDelta,
        payload: {
          sessionId: "session-1",
          messageId: "assistant-batch-1",
          toolCallId: "tool-write-1",
          delta: "\"content\":\"hello\"}",
        },
      },
    ]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(manager.getSnapshot().streamingMessage?.parts).toMatchObject([
      {
        type: "tool-invocation",
        toolCallId: "tool-write-1",
        toolName: "write_file",
        state: "partial-call",
        args: "{\"path\":\"src/app.ts\",\"content\":\"hello\"}",
      },
    ]);
  });

  it("keeps tool invocation order when results complete out of order", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    await manager.dispatchBatch([
      {
        type: NcpEventType.MessageToolCallStart,
        payload: {
          sessionId: "session-1",
          messageId: "assistant-batch-1",
          toolCallId: "call-1",
          toolName: "read_file",
        },
      },
      {
        type: NcpEventType.MessageToolCallStart,
        payload: {
          sessionId: "session-1",
          messageId: "assistant-batch-1",
          toolCallId: "call-2",
          toolName: "read_file",
        },
      },
      {
        type: NcpEventType.MessageToolCallResult,
        payload: { sessionId: "session-1", toolCallId: "call-2", content: "second" },
      },
      {
        type: NcpEventType.MessageToolCallResult,
        payload: { sessionId: "session-1", toolCallId: "call-1", content: "first" },
      },
    ]);

    expect(manager.getSnapshot().streamingMessage?.parts).toMatchObject([
      { type: "tool-invocation", toolCallId: "call-1", state: "result", result: "first" },
      { type: "tool-invocation", toolCallId: "call-2", state: "result", result: "second" },
    ]);
  });
});
