import type {
  NcpAgentRunStreamOptions,
  NcpEndpointEvent,
  NcpEndpointSubscriber,
  NcpMessage,
  NcpSessionSummary,
  NcpStreamRequestPayload,
} from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import type {
  AgentSessionStore,
  LiveSessionState,
} from "./agent-backend.types.js";
import type { AgentLiveSessionRegistry } from "./agent-live-session-registry.service.js";
import { createAsyncQueue } from "./async-queue.js";

type PublishSessionEventOptions = {
  dispatchToStateManager?: boolean;
  persistSession?: boolean;
};

type AgentBackendSessionRealtimeParams = {
  sessionRegistry: AgentLiveSessionRegistry;
  sessionStore: AgentSessionStore;
  publishEndpointEvent: (event: NcpEndpointEvent) => void;
  subscribeEndpointEvent: (listener: NcpEndpointSubscriber) => () => void;
  persistSession: (sessionId: string) => Promise<void>;
  persistSessionEvent: (
    session: LiveSessionState,
    event: NcpEndpointEvent,
  ) => Promise<void>;
  getSessionSummary: (sessionId: string) => Promise<NcpSessionSummary | null>;
};

function readEventSessionId(event: NcpEndpointEvent): string | null {
  const payload = "payload" in event ? event.payload : null;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return "sessionId" in payload && typeof payload.sessionId === "string"
    ? payload.sessionId
    : null;
}

export class AgentBackendSessionRealtime {
  constructor(private readonly params: AgentBackendSessionRealtimeParams) {}

  publishSessionEvent = async (
    session: LiveSessionState,
    event: NcpEndpointEvent,
    options: PublishSessionEventOptions = {},
  ): Promise<void> => {
    if (options.dispatchToStateManager) {
      await session.stateManager.dispatch(event);
    }
    if (options.persistSession !== false) {
      await this.params.persistSessionEvent(session, event);
    }
    this.params.publishEndpointEvent(event);
    session.publisher.publish(event);
  };

  streamSessionEvents = (
    payloadOrParams:
      | NcpStreamRequestPayload
      | { payload: NcpStreamRequestPayload; signal: AbortSignal },
    opts?: NcpAgentRunStreamOptions,
  ): AsyncIterable<NcpEndpointEvent> => {
    return (async function* (
      self: AgentBackendSessionRealtime,
    ): AsyncGenerator<NcpEndpointEvent> {
      const payload =
        "payload" in payloadOrParams && "signal" in payloadOrParams
          ? payloadOrParams.payload
          : payloadOrParams;
      const signal =
        "payload" in payloadOrParams && "signal" in payloadOrParams
          ? payloadOrParams.signal
          : (opts?.signal ?? new AbortController().signal);
      const queue = createAsyncQueue<NcpEndpointEvent>();
      const unsubscribe = self.params.subscribeEndpointEvent((event) => {
        if (readEventSessionId(event) !== payload.sessionId) {
          return;
        }
        queue.push(event);
      });
      const stop = () => {
        unsubscribe();
        queue.close();
        signal.removeEventListener("abort", stop);
      };

      const liveSession = self.params.sessionRegistry.getSession(payload.sessionId);
      const unsubscribeClose = liveSession
        ? liveSession.publisher.onClose(() => {
            queue.close();
          })
        : () => undefined;
      signal.addEventListener("abort", stop, { once: true });

      try {
        for await (const event of queue.iterable) {
          if (signal.aborted) {
            break;
          }
          yield event;
        }
      } finally {
        unsubscribeClose();
        stop();
      }
    })(this);
  };

  appendMessage = async (
    sessionId: string,
    message: NcpMessage,
  ): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return null;
    }

    let liveSession =
      this.params.sessionRegistry.getSession(normalizedSessionId);
    if (!liveSession) {
      const storedSession =
        await this.params.sessionStore.getSession(normalizedSessionId);
      if (!storedSession) {
        return null;
      }
      liveSession =
        await this.params.sessionRegistry.ensureSession(normalizedSessionId);
    }

    const nextMessage: NcpMessage = {
      ...structuredClone(message),
      sessionId: normalizedSessionId,
    };
    await this.publishSessionEvent(
      liveSession,
      {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: normalizedSessionId,
          message: nextMessage,
        },
      },
      {
        dispatchToStateManager: true,
      },
    );
    return this.params.getSessionSummary(normalizedSessionId);
  };

  updateToolCallResult = async (
    sessionId: string,
    toolCallId: string,
    content: unknown,
  ): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = sessionId.trim();
    const normalizedToolCallId = toolCallId.trim();
    if (!normalizedSessionId || !normalizedToolCallId) {
      return null;
    }

    const liveSession =
      await this.params.sessionRegistry.ensureSession(normalizedSessionId);
    await this.publishSessionEvent(
      liveSession,
      {
        type: NcpEventType.MessageToolCallResult,
        payload: {
          sessionId: normalizedSessionId,
          toolCallId: normalizedToolCallId,
          content,
        },
      },
      {
        dispatchToStateManager: true,
      },
    );
    return this.params.getSessionSummary(normalizedSessionId);
  };
}
