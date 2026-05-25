import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage, type NcpRunHandle } from "@nextclaw/ncp";
import {
  EventBus,
  eventKeys,
  Ingress,
  ingressKeys,
  type AgentRunSendIngressPayload,
} from "@nextclaw/shared";
import { AgentRunClient } from "./nextclaw-ncp-runner.utils.js";

function createAssistantMessage(params: {
  sessionId: string;
  messageId: string;
  text: string;
}): NcpMessage {
  const { messageId, sessionId, text } = params;
  return {
    id: messageId,
    sessionId,
    role: "assistant",
    status: "final",
    timestamp: new Date().toISOString(),
    parts: [{ type: "text", text }],
  };
}

describe("AgentRunClient", () => {
  it("subscribes before sending so early reply events are not missed", async () => {
    const eventBus = new EventBus();
    const ingress = new Ingress();
    const assistantMessage = createAssistantMessage({
      sessionId: "session-1",
      messageId: "assistant-1",
      text: "hello from ingress",
    });
    ingress.addHandler<AgentRunSendIngressPayload, NcpRunHandle>(
      ingressKeys.agentRun.send,
      async (envelope) => {
        const correlationId = envelope.payload?.correlationId;
        eventBus.emit(eventKeys.ncpEvent, {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: "session-1",
            messageId: assistantMessage.id,
            delta: "hello ",
            correlationId,
          },
        });
        eventBus.emit(eventKeys.ncpEvent, {
          type: NcpEventType.MessageCompleted,
          payload: {
            sessionId: "session-1",
            message: assistantMessage,
            correlationId,
          },
        });
        eventBus.emit(eventKeys.ncpEvent, {
          type: NcpEventType.RunFinished,
          payload: {
            sessionId: "session-1",
            messageId: assistantMessage.id,
            runId: "run-1",
            correlationId,
          },
        });
        return {
          sessionId: "session-1",
          userMessageId: "user-1",
          assistantMessageId: null,
          runId: "run-1",
          correlationId,
        };
      },
    );

    const deltas: string[] = [];
    const client = new AgentRunClient({ eventBus, ingress });
    const reply = await client.sendAndWaitForReply({
      sessionId: "session-1",
      content: [{ type: "text", text: "hi" }],
      metadata: { agentId: "main" },
    }, {
      onAssistantDelta: (delta) => deltas.push(delta),
    });

    expect(deltas).toEqual(["hello "]);
    expect(reply.text).toBe("hello from ingress");
    expect(reply.completedMessage).toBe(assistantMessage);
  });
});
