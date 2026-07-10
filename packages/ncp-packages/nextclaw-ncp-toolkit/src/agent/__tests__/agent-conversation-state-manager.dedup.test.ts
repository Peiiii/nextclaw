import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state.manager.js";

const createFinalAssistantMessage = (): NcpMessage => ({
  id: "assistant-1",
  sessionId: "session-1",
  role: "assistant",
  status: "final",
  parts: [{ type: "text", text: "done" }],
  timestamp: "2026-03-12T00:00:00.000Z",
});

describe("DefaultNcpAgentConversationStateManager message deduplication", () => {
  it("clears a streaming duplicate when the final message is upserted by id", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    await manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: { sessionId: "session-1", messageId: "assistant-1" },
    });
    await manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: { sessionId: "session-1", messageId: "assistant-1", delta: "done" },
    });
    await manager.dispatch({
      type: NcpEventType.MessageTextEnd,
      payload: { sessionId: "session-1", messageId: "assistant-1" },
    });
    await manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: { sessionId: "session-1", message: createFinalAssistantMessage() },
    });

    const snapshot = manager.getSnapshot();
    expect(snapshot.streamingMessage).toBeNull();
    expect(snapshot.messages.map((message) => message.id)).toEqual(["assistant-1"]);
    expect(snapshot.messages[0]?.status).toBe("final");
  });
});
