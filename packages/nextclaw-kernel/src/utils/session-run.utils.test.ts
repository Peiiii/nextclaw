import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { normalizeSendRunEvent, type LiveSession } from "./session-run.utils.js";

const finalMessage: NcpMessage = {
  id: "assistant-1",
  sessionId: "session-1",
  role: "assistant",
  status: "final",
  parts: [{ type: "text", text: "done" }],
  timestamp: "2026-05-23T00:00:00.000Z",
};

function createLiveSession(): LiveSession {
  return {
    sessionId: "session-1",
    stateManager: {
      getSnapshot: () => ({
        messages: [finalMessage],
        streamingMessage: null,
      }),
    },
    runtime: {},
    activeExecution: null,
  } as unknown as LiveSession;
}

describe("normalizeSendRunEvent", () => {
  it("carries run correlation id onto synthesized completed messages", () => {
    const normalized = normalizeSendRunEvent({
      session: createLiveSession(),
      completedMessageSeen: false,
      event: {
        type: NcpEventType.RunFinished,
        payload: {
          sessionId: "session-1",
          messageId: "assistant-1",
          correlationId: "request-1",
        },
      },
    });

    expect(normalized.eventsToPublish[0]).toMatchObject({
      type: NcpEventType.MessageCompleted,
      payload: {
        correlationId: "request-1",
        message: { id: "assistant-1" },
      },
    });
  });
});
