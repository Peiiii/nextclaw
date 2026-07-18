import { describe, expect, it } from "vitest";
import { DefaultNcpAgentConversationStateManager } from "./agent-conversation-state.manager.js";

describe("DefaultNcpAgentConversationStateManager history", () => {
  it("prepends unique history without replacing newer live message objects", () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    const liveMessage = {
      id: "message-3",
      sessionId: "session-1",
      role: "assistant" as const,
      status: "final" as const,
      parts: [{ type: "text" as const, text: "live" }],
      timestamp: "2026-07-18T00:00:03.000Z"
    };
    manager.hydrate({ sessionId: "session-1", messages: [liveMessage] });
    const hydratedLiveMessage = manager.getSnapshot().messages[0];

    manager.prependHistory([
      {
        id: "message-1",
        sessionId: "session-1",
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "older" }],
        timestamp: "2026-07-18T00:00:01.000Z"
      },
      { ...liveMessage, parts: [{ type: "text", text: "stale" }] }
    ]);

    const snapshot = manager.getSnapshot();
    expect(snapshot.messages.map((message) => message.id)).toEqual(["message-1", "message-3"]);
    expect(snapshot.messages[1]).toBe(hydratedLiveMessage);
    expect(snapshot.messages[1]?.parts).toEqual([{ type: "text", text: "live" }]);
  });
});
