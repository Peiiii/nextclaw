import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import {
  eventKeys,
  ingressKeys,
  type EventBus,
  type Ingress,
  type Unsubscribe,
} from "@nextclaw/shared";
import type {
  SessionRequestDispatcher,
  SessionRequestRecord,
} from "@nextclaw/core";

export type AgentRuntimeSessionRequestDispatcherOptions = {
  eventBus: EventBus;
  ingress: Ingress;
};

function extractSessionMessageText(message: NcpMessage): string | undefined {
  const parts = message.parts
    .flatMap((part) => part.type === "text" || part.type === "rich-text" ? [part.text] : [])
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export function waitForAgentRuntimeSessionReply(input: {
  eventBus: EventBus;
  onAccepted: (messageId: string) => void;
  requestId: string;
}): { dispose: Unsubscribe; promise: Promise<NcpMessage> } {
  let acceptedMessageId: string | null = null;
  let unsubscribe: Unsubscribe = () => undefined;
  const promise = new Promise<NcpMessage>((resolve, reject) => {
    unsubscribe = input.eventBus.on(eventKeys.ncpEvent, (event) => {
      switch (event.type) {
        case NcpEventType.MessageAccepted:
          if (event.payload.correlationId === input.requestId) {
            acceptedMessageId = event.payload.messageId;
            input.onAccepted(event.payload.messageId);
          }
          return;
        case NcpEventType.MessageCompleted:
          if (
            event.payload.correlationId === input.requestId ||
            event.payload.message.id === acceptedMessageId
          ) {
            unsubscribe();
            resolve(event.payload.message);
          }
          return;
        case NcpEventType.MessageFailed:
          if (
            event.payload.correlationId === input.requestId ||
            event.payload.messageId === acceptedMessageId
          ) {
            unsubscribe();
            reject(new Error(event.payload.error.message));
          }
          return;
        case NcpEventType.RunError:
          if (event.payload.messageId === acceptedMessageId) {
            unsubscribe();
            reject(new Error(event.payload.error ?? "Session request failed."));
          }
          return;
      }
    });
  });
  return {
    dispose: unsubscribe,
    promise,
  };
}

export async function dispatchAgentRuntimeSessionRequest(input: {
  ingress: Ingress;
  request: SessionRequestRecord;
  task: string;
}): Promise<void> {
  await input.ingress.handle({
    type: ingressKeys.agentRun.sessionMessageRequest,
    payload: {
      message: {
        id: `${input.request.targetSessionId}:user:session-request:${input.request.requestId}`,
        sessionId: input.request.targetSessionId,
        role: "user",
        status: "final",
        timestamp: new Date().toISOString(),
        parts: [{ type: "text", text: input.task }],
        metadata: { session_request_id: input.request.requestId },
      },
      requestId: input.request.requestId,
      sessionId: input.request.targetSessionId,
    },
  }, { source: "session-request" });
}

export function createAgentRuntimeSessionRequestDispatcher(
  options: AgentRuntimeSessionRequestDispatcherOptions,
): SessionRequestDispatcher {
  return {
    dispatch: async (input) => {
      const reply = waitForAgentRuntimeSessionReply({
        eventBus: options.eventBus,
        onAccepted: input.onAccepted,
        requestId: input.request.requestId,
      });
      try {
        await dispatchAgentRuntimeSessionRequest({
          ingress: options.ingress,
          request: input.request,
          task: input.task,
        });
        const message = await reply.promise;
        return {
          finalResponseMessageId: message.id,
          finalResponseText: extractSessionMessageText(message),
        };
      } catch (error) {
        reply.dispose();
        throw error;
      }
    },
  };
}
