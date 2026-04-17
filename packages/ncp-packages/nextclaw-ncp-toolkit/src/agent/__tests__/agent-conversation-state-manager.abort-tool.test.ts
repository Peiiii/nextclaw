import { describe, expect, it } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state-manager.js";

describe("DefaultNcpAgentConversationStateManager aborting in-flight tools", () => {
  it("marks the active tool call as cancelled and ignores late tail events", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-tool-abort",
        toolCallId: "tool-abort-1",
        toolName: "write_file",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallArgs,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-abort-1",
        args: '{"path":"src/app.ts","content":"hello"}',
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallEnd,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-abort-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-tool-abort",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-abort-1",
        content: "late result should be ignored",
      },
    });

    const snapshot = manager.getSnapshot();
    expect(snapshot.streamingMessage).toBeNull();
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]).toMatchObject({
      id: "assistant-tool-abort",
      status: "final",
      parts: [
        {
          type: "tool-invocation",
          toolCallId: "tool-abort-1",
          toolName: "write_file",
          state: "cancelled",
          args: '{"path":"src/app.ts","content":"hello"}',
        },
      ],
    });
  });
});
