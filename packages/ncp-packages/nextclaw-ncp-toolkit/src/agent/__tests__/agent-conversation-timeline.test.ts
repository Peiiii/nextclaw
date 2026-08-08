import { describe, expect, it } from "vitest";
import { type NcpMessage, NcpEventType } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state.manager.js";
import { insertMessageByTimeline } from "../agent-conversation-state-manager.utils.js";

const createMessage = (overrides: Partial<NcpMessage> = {}): NcpMessage => ({
  id: "msg-1",
  sessionId: "session-1",
  role: "assistant",
  status: "final",
  parts: [],
  timestamp: "2026-03-12T00:00:00.000Z",
  ...overrides
});

describe("agent conversation timeline", () => {
  it("inserts transient messages in their stable timeline positions", () => {
    const userFirst = createMessage({
      id: "user-first",
      role: "user",
      timestamp: "2026-03-12T00:00:00.000Z"
    });
    const userLater = createMessage({
      id: "user-later",
      role: "user",
      timestamp: "2026-03-12T00:00:02.000Z"
    });
    const assistantStreaming = createMessage({
      id: "assistant-streaming",
      status: "streaming",
      timestamp: "2026-03-12T00:00:01.000Z"
    });
    const userOptimistic = createMessage({
      id: "user-optimistic",
      role: "user",
      timestamp: "2026-03-12T00:00:03.000Z"
    });

    const withOptimistic = insertMessageByTimeline([userFirst, userLater], userOptimistic);
    expect(insertMessageByTimeline(withOptimistic, assistantStreaming).map((message) => message.id)).toEqual([
      "user-first",
      "assistant-streaming",
      "user-later",
      "user-optimistic"
    ]);
  });

  it("settles an orphaned streaming assistant before a different run starts", () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: { sessionId: "session-1", runId: "run-old" }
    });
    manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "assistant-old",
          status: "streaming",
          parts: [{ type: "text", text: "partial" }],
          timestamp: "2026-03-12T00:00:01.000Z"
        })
      }
    });
    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: { sessionId: "session-1", messageId: "assistant-old" }
    });
    manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "user-later",
          role: "user",
          timestamp: "2026-03-12T00:00:02.000Z"
        })
      }
    });

    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: { sessionId: "session-1", runId: "run-new" }
    });
    manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "assistant-new",
          status: "streaming",
          parts: [{ type: "text", text: "new reply" }],
          timestamp: "2026-03-12T00:00:03.000Z"
        })
      }
    });
    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: { sessionId: "session-1", messageId: "assistant-new" }
    });

    const snapshot = manager.getSnapshot();
    expect(snapshot.messages).toMatchObject([
      { id: "assistant-old", status: "final", parts: [{ text: "partial" }] },
      { id: "user-later" }
    ]);
    expect(snapshot.streamingMessage).toMatchObject({
      id: "assistant-new",
      status: "streaming",
      parts: [{ text: "new reply" }]
    });
    expect(snapshot.activeRun?.runId).toBe("run-new");
  });
});
