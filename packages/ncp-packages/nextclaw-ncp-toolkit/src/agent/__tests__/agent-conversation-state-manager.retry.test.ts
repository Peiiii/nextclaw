import { describe, expect, it } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state.manager.js";

describe("DefaultNcpAgentConversationStateManager retry attempts", () => {
  it("starts a new text part when a retry attempt reuses an active assistant message", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        delta: "partial",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        runId: "run-1",
        metadata: {
          type: "retry",
          attempt: 1,
          message: "Network stream closed before response.completed",
          next: 2_000,
        },
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        delta: "recovered",
      },
    });

    expect(manager.getSnapshot().streamingMessage?.parts).toEqual([
      { type: "text", text: "partial" },
      { type: "text", text: "recovered" },
    ]);
  });
});
