import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { SessionRun } from "@kernel/managers/session-run.manager.js";

function message(id: string, role: NcpMessage["role"], timestamp: string): NcpMessage {
  return {
    id,
    sessionId: "session-1",
    role,
    status: "final",
    parts: [],
    timestamp
  };
}

describe("SessionRun", () => {
  it("materializes a streaming assistant before a later stable user message", async () => {
    const run = new SessionRun({
      sessionId: "session-1",
      messages: [
        message("user-first", "user", "2026-05-14T00:00:00.000Z"),
        message("user-later", "user", "2026-05-14T00:00:02.000Z")
      ]
    });

    await run.applyEvents([
      {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: "session-1",
          message: {
            ...message("assistant-old", "assistant", "2026-05-14T00:00:01.000Z"),
            status: "streaming"
          }
        }
      },
      {
        type: NcpEventType.MessageTextStart,
        payload: { sessionId: "session-1", messageId: "assistant-old" }
      }
    ]);

    expect(run.getSnapshot().messages.map((item) => item.id)).toEqual([
      "user-first",
      "assistant-old",
      "user-later"
    ]);
  });
});
