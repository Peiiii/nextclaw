import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import {
  type NcpAgentClientEndpoint,
  type NcpAgentSendEnvelope,
  type NcpAgentConversationSnapshot,
  type NcpEndpointEvent,
  type NcpError,
  type NcpMessage,
  type NcpOutboundMessageDraft,
  type NcpRunHandle,
} from "@nextclaw/ncp";

export type NcpAgentSendInput = string | NcpAgentSendEnvelope;

export type UseNcpAgentResult = {
  snapshot: NcpAgentConversationSnapshot;
  visibleMessages: readonly NcpMessage[];
  activeRunId: string | null;
  isRunning: boolean;
  isSending: boolean;
  send: (input: NcpAgentSendInput) => Promise<NcpRunHandle | null>;
  abort: () => Promise<void>;
  streamRun: () => Promise<void>;
};

type UseNcpAgentRuntimeOptions = {
  sessionId?: string;
  client: NcpAgentClientEndpoint;
  manager: DefaultNcpAgentConversationStateManager;
};

type ScopedManagerRef = {
  sessionId: string | null;
  manager: DefaultNcpAgentConversationStateManager;
};

const EVENT_BATCH_DELAY_MS = 16;
const USER_ABORT_REASON: NcpError = {
  code: "abort-error",
  message: "User stopped the current run.",
  details: { source: "chat-ui" },
};

class NcpEventDispatchBatcher {
  private readonly queue: NcpEndpointEvent[] = [];
  private flushTimerId: number | null = null;
  private isFlushing = false;
  private isDisposed = false;

  constructor(
    private readonly dispatchBatch: (
      events: readonly NcpEndpointEvent[],
    ) => Promise<void>,
  ) {}

  enqueue = (event: NcpEndpointEvent): void => {
    if (this.isDisposed) {
      return;
    }
    this.queue.push(event);
    this.scheduleFlush();
  };

  dispose = (): void => {
    this.isDisposed = true;
    if (this.flushTimerId !== null) {
      window.clearTimeout(this.flushTimerId);
      this.flushTimerId = null;
    }
    this.queue.length = 0;
  };

  private scheduleFlush = (): void => {
    if (
      this.flushTimerId !== null ||
      this.isFlushing ||
      this.queue.length === 0
    ) {
      return;
    }
    this.flushTimerId = window.setTimeout(() => {
      this.flushTimerId = null;
      void this.flush();
    }, EVENT_BATCH_DELAY_MS);
  };

  private flush = async (): Promise<void> => {
    if (this.isDisposed || this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0);
        await this.dispatchBatch(batch);
      }
    } finally {
      this.isFlushing = false;
      this.scheduleFlush();
    }
  };
}

function dispatchEventsToManager(
  manager: DefaultNcpAgentConversationStateManager,
  events: readonly NcpEndpointEvent[],
): Promise<void> {
  const batchDispatch = (
    manager as DefaultNcpAgentConversationStateManager & {
      dispatchBatch?: (batch: readonly NcpEndpointEvent[]) => Promise<void>;
    }
  ).dispatchBatch;
  if (typeof batchDispatch === "function") {
    return batchDispatch.call(manager, events);
  }

  return events.reduce<Promise<void>>(
    (chain, event) => chain.then(() => manager.dispatch(event)),
    Promise.resolve(),
  );
}

function shouldDispatchEventToSession(
  event: NcpEndpointEvent,
  sessionId: string | undefined,
): boolean {
  if (!sessionId) {
    return true;
  }
  const payload = "payload" in event ? event.payload : null;
  if (!payload || typeof payload !== "object") {
    return true;
  }
  if (!("sessionId" in payload) || typeof payload.sessionId !== "string") {
    return true;
  }
  return payload.sessionId === sessionId;
}

function hasMessageContent(message: NcpMessage | NcpOutboundMessageDraft): boolean {
  return message.parts.some((part) => {
    if (
      part.type === "text" ||
      part.type === "rich-text" ||
      part.type === "reasoning"
    ) {
      return part.text.trim().length > 0;
    }
    return true;
  });
}

function normalizeSendEnvelope(
  input: NcpAgentSendInput,
  sessionId: string | undefined,
): NcpAgentSendEnvelope | null {
  if (typeof input === "string") {
    const content = input.trim();
    if (!content) {
      return null;
    }
    return {
      ...(sessionId ? { sessionId } : {}),
      message: {
        id: `user-${Date.now().toString(36)}`,
        ...(sessionId ? { sessionId } : {}),
        role: "user",
        status: "final",
        parts: [{ type: "text", text: content }],
        timestamp: new Date().toISOString(),
      },
    };
  }

  if (!hasMessageContent(input.message)) {
    return null;
  }

  const targetSessionId = input.sessionId || input.message.sessionId || sessionId;
  return {
    ...input,
    ...(targetSessionId ? { sessionId: targetSessionId } : {}),
    message: {
      ...input.message,
      ...(targetSessionId
        ? { sessionId: targetSessionId }
        : {}),
    },
  };
}

export function useScopedAgentManager(
  sessionId: string | undefined,
): DefaultNcpAgentConversationStateManager {
  const managerRef = useRef<ScopedManagerRef>();
  if (!managerRef.current) {
    managerRef.current = {
      sessionId: sessionId ?? null,
      manager: new DefaultNcpAgentConversationStateManager(),
    };
  } else if (sessionId && managerRef.current.sessionId === null) {
    managerRef.current.sessionId = sessionId;
  } else if (managerRef.current.sessionId !== (sessionId ?? null)) {
    managerRef.current = {
      sessionId: sessionId ?? null,
      manager: new DefaultNcpAgentConversationStateManager(),
    };
  }
  return managerRef.current.manager;
}

export function useNcpAgentRuntime({
  sessionId,
  client,
  manager,
}: UseNcpAgentRuntimeOptions): UseNcpAgentResult {
  const sessionIdRef = useRef<string | undefined>(sessionId);
  const snapshot = useSyncExternalStore(
    (onStoreChange) => manager.subscribe(() => onStoreChange()),
    () => manager.getSnapshot(),
    () => manager.getSnapshot(),
  );
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    setIsSending(false);
  }, [sessionId]);

  useEffect(() => {
    const eventBatcher = new NcpEventDispatchBatcher((events) =>
      dispatchEventsToManager(manager, events),
    );
    const unsubscribeClient = client.subscribe((event) => {
      if (!shouldDispatchEventToSession(event, sessionIdRef.current)) {
        return;
      }
      eventBatcher.enqueue(event);
    });

    return () => {
      unsubscribeClient();
      eventBatcher.dispose();
      void client.stop();
    };
  }, [client, manager]);

  const visibleMessages: readonly NcpMessage[] = snapshot.streamingMessage
    ? [...snapshot.messages, snapshot.streamingMessage]
    : snapshot.messages;

  const activeRunId = snapshot.activeRun?.runId ?? null;
  const isRunning = !!snapshot.activeRun;

  const send = async (input: NcpAgentSendInput) => {
    if (isSending) {
      return null;
    }
    const envelope = normalizeSendEnvelope(input, sessionId);
    if (!envelope) {
      return null;
    }

    manager.clearError();
    setIsSending(true);
    try {
      return await client.send(envelope);
    } finally {
      setIsSending(false);
    }
  };

  const abort = async () => {
    if (!sessionId) {
      return;
    }

    await client.abort({
      sessionId,
      runId: activeRunId ?? undefined,
      reason: USER_ABORT_REASON,
    });
  };

  const streamRun = async () => {
    if (!sessionId) {
      return;
    }
    await client.stop();
    await client.stream({ sessionId });
  };

  return {
    snapshot,
    visibleMessages,
    activeRunId,
    isRunning,
    isSending,
    send,
    abort,
    streamRun,
  };
}
