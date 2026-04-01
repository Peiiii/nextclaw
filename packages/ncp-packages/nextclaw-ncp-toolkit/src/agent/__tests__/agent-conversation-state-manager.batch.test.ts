import { describe, expect, it, vi } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state-manager.js";

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
});
