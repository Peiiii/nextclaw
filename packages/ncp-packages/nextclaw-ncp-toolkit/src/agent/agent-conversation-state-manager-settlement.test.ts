import { describe, expect, it } from "vitest";
import { type NcpMessage, NcpEventType } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "./agent-conversation-state.manager.js";

const createMessage = (overrides: Partial<NcpMessage> = {}): NcpMessage => ({
  id: "msg-1",
  sessionId: "session-1",
  role: "assistant",
  status: "final",
  parts: [],
  timestamp: "2026-03-12T00:00:00.000Z",
  ...overrides,
});

describe("DefaultNcpAgentConversationStateManager settlement", () => {
  it("settles replayed assistant in its timeline position when later user messages arrive", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "first" }],
          timestamp: "2026-03-12T00:00:00.000Z",
        }),
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "assistant-1",
          status: "streaming",
          parts: [{ type: "text", text: "working" }],
          timestamp: "2026-03-12T00:00:01.000Z",
        }),
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
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "user-2",
          role: "user",
          parts: [{ type: "text", text: "later" }],
          timestamp: "2026-03-12T00:00:02.000Z",
        }),
      },
    });

    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });

    expect(manager.getSnapshot().messages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
      "user-2",
    ]);
  });

  it("settles assistant message lifecycle from run timing facts", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
        startedAt: "2026-03-12T00:00:00.000Z",
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
        delta: "done",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
        startedAt: "2026-03-12T00:00:00.000Z",
        endedAt: "2026-03-12T00:03:51.000Z",
      },
    });

    expect(manager.getSnapshot().messages[0]?.lifecycle).toEqual({
      startedAt: "2026-03-12T00:00:00.000Z",
      endedAt: "2026-03-12T00:03:51.000Z",
    });
  });
});
