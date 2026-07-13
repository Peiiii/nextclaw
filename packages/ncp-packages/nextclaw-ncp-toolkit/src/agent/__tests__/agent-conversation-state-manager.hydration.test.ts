import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state.manager.js";

describe("DefaultNcpAgentConversationStateManager tool hydration", () => {
  it("continues partial tool arguments without dropping their hydrated prefix", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    const argsPrefix = '{"path":"src/app.ts","oldText":"before","newText":"aft';
    const message: NcpMessage = {
      id: "assistant-tool-resume",
      sessionId: "session-tool-resume",
      role: "assistant",
      status: "streaming",
      timestamp: "2026-03-12T00:00:00.000Z",
      parts: [
        {
          type: "tool-invocation",
          toolCallId: "tool-edit-resume",
          toolName: "edit_file",
          state: "partial-call",
          args: argsPrefix,
        },
      ],
    };

    manager.hydrate({
      sessionId: "session-tool-resume",
      messages: [message],
      activeRun: { runId: null },
    });

    await manager.dispatch({
      type: NcpEventType.MessageToolCallArgsDelta,
      payload: {
        sessionId: "session-tool-resume",
        messageId: "assistant-tool-resume",
        toolCallId: "tool-edit-resume",
        delta: 'er"}',
      },
    });

    expect(manager.getSnapshot().streamingMessage).toMatchObject({
      id: "assistant-tool-resume",
      parts: [
        {
          type: "tool-invocation",
          toolCallId: "tool-edit-resume",
          toolName: "edit_file",
          state: "partial-call",
          args: `${argsPrefix}er"}`,
        },
      ],
    });
  });
});
