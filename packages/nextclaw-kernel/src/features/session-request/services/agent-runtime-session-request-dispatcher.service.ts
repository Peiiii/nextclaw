import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import {
  createTypedKey,
  eventKeys,
  type EventBus,
  type Ingress,
  type Unsubscribe,
} from "@nextclaw/shared";
import type {
  SessionRequestDispatcher,
  SessionRequestDispatchResult,
  SessionRequestRecord,
} from "@nextclaw/core";

export const AGENT_RUNTIME_SESSION_MESSAGE_INGRESS_TYPE =
  createTypedKey<AgentRuntimeSessionMessageRequest>(
    "agent-runtime.session-message.request",
  );

export type AgentRuntimeSessionMessageRequest = {
  message: NcpMessage;
  requestId: string;
  sessionId: string;
};

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

function createUserMessage(input: {
  request: SessionRequestRecord;
  task: string;
}): NcpMessage {
  return {
    id: `${input.request.targetSessionId}:user:session-request:${input.request.requestId}`,
    sessionId: input.request.targetSessionId,
    role: "user",
    status: "final",
    timestamp: new Date().toISOString(),
    parts: [{ type: "text", text: input.task }],
    metadata: { session_request_id: input.request.requestId },
  };
}

export class AgentRuntimeSessionRequestDispatcher implements SessionRequestDispatcher {
  constructor(private readonly options: AgentRuntimeSessionRequestDispatcherOptions) {}

  dispatch = async (input: {
    request: SessionRequestRecord;
    task: string;
    onAccepted: (messageId: string) => void;
  }): Promise<SessionRequestDispatchResult> => {
    const reply = waitForReply({
      eventBus: this.options.eventBus,
      onAccepted: input.onAccepted,
      requestId: input.request.requestId,
    });
    try {
      await this.options.ingress.handle({
        type: AGENT_RUNTIME_SESSION_MESSAGE_INGRESS_TYPE,
        payload: {
          message: createUserMessage(input),
          requestId: input.request.requestId,
          sessionId: input.request.targetSessionId,
        },
      }, { source: "session-request" });
      return toDispatchResult(await reply.promise);
    } catch (error) {
      reply.dispose();
      throw error;
    }
  };
}

function waitForReply(input: {
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

function toDispatchResult(message: NcpMessage): SessionRequestDispatchResult {
  return {
    finalResponseMessageId: message.id,
    finalResponseText: extractSessionMessageText(message),
  };
}
