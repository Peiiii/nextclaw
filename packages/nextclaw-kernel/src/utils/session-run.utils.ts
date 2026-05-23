import {
  NcpEventType,
  type NcpAgentConversationStateManager,
  type NcpAgentRuntime,
  type NcpAgentSendEnvelope,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpRequestEnvelope,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import type {
  AgentSessionRecord,
} from "@nextclaw/ncp-toolkit";

export type LiveSessionExecution = {
  runId: string;
  controller: AbortController;
  requestEnvelope: MaterializedAgentRunRequest;
  abortHandled: boolean;
  closed: boolean;
};

export type MaterializedAgentRunRequest = NcpRequestEnvelope & {
  runId: string;
};

export type LiveSession = {
  sessionId: string;
  agentId?: string;
  createdAt: string;
  stateManager: NcpAgentConversationStateManager;
  metadata: Record<string, unknown>;
  runtime: NcpAgentRuntime;
  activeExecution: LiveSessionExecution | null;
};

export type PublishSessionEventOptions = {
  dispatchToStateManager?: boolean;
  persistSession?: boolean;
};

export class AsyncEventQueue<T> {
  private readonly items: T[] = [];
  private readonly waiters: Array<(value: IteratorResult<T>) => void> = [];
  private closed = false;

  push = (item: T): void => {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: item, done: false });
      return;
    }
    this.items.push(item);
  };

  close = (): void => {
    if (this.closed) {
      return;
    }
    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.({ value: undefined, done: true });
    }
  };

  iterate = (): AsyncGenerator<T> => {
    const nextItem = this.next;
    return (async function* iterateQueuedEvents() {
      while (true) {
        const next = await nextItem();
        if (next.done) {
          return;
        }
        yield next.value;
      }
    })();
  };

  private next = async (): Promise<IteratorResult<T>> => {
    const item = this.items.shift();
    if (item) {
      return { value: item, done: false };
    }
    if (this.closed) {
      return { value: undefined, done: true };
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  };
}

export function readString(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}

export function readAgentId(metadata: Record<string, unknown> | null | undefined): string | undefined {
  return readString(metadata?.agent_id)?.toLowerCase() ?? readString(metadata?.agentId)?.toLowerCase();
}

export function readMessageTask(message: NcpAgentSendEnvelope["message"]): string {
  return message.parts.flatMap((part) => (
    (part.type === "text" || part.type === "rich-text" || part.type === "reasoning") &&
    part.text.trim() ? [part.text.trim()] : []
  ))[0] ?? "Session";
}

export function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  ...keys: string[]
): string | undefined {
  return keys.map((key) => readString(metadata?.[key])).find(Boolean);
}

export function withSession(envelope: NcpAgentSendEnvelope, sessionId: string): NcpRequestEnvelope {
  return { ...envelope, sessionId, message: { ...envelope.message, sessionId } };
}

export function isTerminalRunEvent(event: NcpEndpointEvent): boolean {
  return event.type === NcpEventType.MessageCompleted || event.type === NcpEventType.MessageFailed || event.type === NcpEventType.RunError;
}

function readMessages(session: LiveSession): NcpMessage[] {
  const snapshot = session.stateManager.getSnapshot();
  const messages = snapshot.messages.map((message) => structuredClone(message));
  if (snapshot.streamingMessage && !messages.some((message) => message.id === snapshot.streamingMessage?.id)) {
    messages.push(structuredClone(snapshot.streamingMessage));
  }
  return messages;
}

function resolveAutoSessionLabel(messages: readonly NcpMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }
    for (const part of message.parts) {
      if (part.type === "text" || part.type === "rich-text") {
        const text = readString(part.text);
        if (text) {
          return text.length > 64 ? `${text.slice(0, 64)}...` : text;
        }
      }
    }
  }
  return null;
}

function withAutoSessionLabel(params: {
  metadata: Record<string, unknown>;
  messages: readonly NcpMessage[];
}): Record<string, unknown> {
  const { metadata, messages } = params;
  if (readString(metadata.label)) {
    return metadata;
  }
  const label = resolveAutoSessionLabel(messages);
  return label ? { ...metadata, label } : metadata;
}

export function buildSessionRecord(session: LiveSession, updatedAt: string): AgentSessionRecord {
  const messages = readMessages(session);
  const requestMetadata = session.activeExecution?.requestEnvelope.metadata;
  const metadata = withAutoSessionLabel({
    metadata: {
      ...structuredClone(session.metadata),
      ...(requestMetadata ? structuredClone(requestMetadata) : {}),
    },
    messages,
  });
  const agentId = readString(session.agentId) ?? readAgentId(metadata);
  return {
    sessionId: session.sessionId,
    ...(agentId ? { agentId } : {}),
    messages,
    createdAt: session.createdAt,
    updatedAt,
    metadata,
  };
}

export function normalizeRunEvent(
  event: NcpEndpointEvent,
  envelope: NcpRequestEnvelope & { runId?: string },
): NcpEndpointEvent {
  if (!("payload" in event) || !event.payload || typeof event.payload !== "object") {
    return structuredClone(event);
  }
  const shouldAddRunId = Boolean(envelope.runId) &&
    (event.type === NcpEventType.RunStarted ||
      event.type === NcpEventType.RunFinished ||
      event.type === NcpEventType.RunError ||
      event.type === NcpEventType.RunMetadata);
  return structuredClone({
    ...event,
    payload: {
      ...event.payload,
      sessionId:
        "sessionId" in event.payload && typeof event.payload.sessionId === "string"
          ? event.payload.sessionId
          : envelope.sessionId,
      ...(envelope.correlationId &&
      (!("correlationId" in event.payload) || typeof event.payload.correlationId !== "string")
        ? { correlationId: envelope.correlationId }
        : {}),
      ...(shouldAddRunId ? { runId: envelope.runId } : {}),
    },
  } as NcpEndpointEvent);
}

function findFinalAssistantMessage(session: LiveSession, messageId: string): NcpMessage | null {
  const normalizedMessageId = messageId.trim();
  if (!normalizedMessageId) {
    return null;
  }
  const messages = session.stateManager.getSnapshot().messages;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.id === normalizedMessageId && message.role === "assistant" && message.status === "final") {
      return structuredClone(message);
    }
  }
  return null;
}

export function normalizeSendRunEvent(params: {
  session: LiveSession;
  event: NcpEndpointEvent;
  completedMessageSeen: boolean;
}): {
  eventsToPublish: NcpEndpointEvent[];
  completedMessageSeen: boolean;
} {
  const { event, session } = params;
  if (event.type === NcpEventType.MessageCompleted) {
    if (params.completedMessageSeen) {
      throw new Error(`Multiple final assistant messages were emitted for session "${session.sessionId}".`);
    }
    return { eventsToPublish: [event], completedMessageSeen: true };
  }
  if (event.type === NcpEventType.RunFinished) {
    if (params.completedMessageSeen) {
      return { eventsToPublish: [event], completedMessageSeen: true };
    }
    const messageId = event.payload.messageId?.trim();
    const message = messageId ? findFinalAssistantMessage(session, messageId) : null;
    if (!message) {
      throw new Error(`Run finished without a final assistant message for session "${session.sessionId}".`);
    }
    return {
      eventsToPublish: [
        {
          type: NcpEventType.MessageCompleted,
          payload: {
            sessionId: session.sessionId,
            message,
          },
        },
        event,
      ],
      completedMessageSeen: true,
    };
  }
  return {
    eventsToPublish: [event],
    completedMessageSeen: params.completedMessageSeen,
  };
}

export function disposeRuntime(runtime: NcpAgentRuntime): Promise<void> | void {
  return (runtime as { dispose?: () => Promise<void> | void }).dispose?.();
}

export function consumeRunHandle(
  events: AsyncIterable<NcpEndpointEvent>,
  fallback: NcpRunHandle,
): Promise<NcpRunHandle> {
  let resolved = false;
  let handle = fallback;
  return new Promise<NcpRunHandle>((resolve, reject) => {
    const resolveOnce = (): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(handle);
    };
    void (async () => {
      try {
        for await (const event of events) {
          if (event.type === NcpEventType.RunStarted) {
            handle = {
              ...handle,
              assistantMessageId: event.payload.messageId ?? null,
              runId: event.payload.runId ?? null,
            };
            resolveOnce();
          }
        }
        resolveOnce();
      } catch (error) {
        if (!resolved) {
          reject(error);
        }
      }
    })();
  });
}
