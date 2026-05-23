import { describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { EventBus, eventKeys } from "@nextclaw/shared";
import { waitForAgentRuntimeSessionReply } from "./agent-runtime-session-request-dispatcher.utils.js";

const finalMessage: NcpMessage = {
  id: "assistant-1",
  sessionId: "session-1",
  role: "assistant",
  status: "final",
  parts: [{ type: "text", text: "done" }],
  timestamp: "2026-05-23T00:00:00.000Z",
};

describe("waitForAgentRuntimeSessionReply", () => {
  it("resolves when run.finished carries the request correlation after an uncorrelated completion", async () => {
    const eventBus = new EventBus();
    const onAccepted = vi.fn();
    const reply = waitForAgentRuntimeSessionReply({
      eventBus,
      onAccepted,
      requestId: "request-1",
    });

    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: "session-1",
        message: finalMessage,
      },
    });
    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        correlationId: "request-1",
      },
    });

    await expect(reply.promise).resolves.toMatchObject({ id: "assistant-1" });
    expect(onAccepted).toHaveBeenCalledWith("assistant-1");
  });
});
