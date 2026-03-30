import type {
  NcpEndpointEvent,
  NcpMessage,
  NcpSessionSummary,
  NcpSessionApi,
} from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import type { AgentSessionStore } from "./agent-backend-types.js";
import type { AgentLiveSessionRegistry } from "./agent-live-session-registry.js";
import type { EventPublisher } from "./event-publisher.js";

export async function appendAgentBackendMessage(params: {
  sessionId: string;
  message: NcpMessage;
  sessionRegistry: AgentLiveSessionRegistry;
  sessionStore: AgentSessionStore;
  publisher: EventPublisher;
  persistSession: (sessionId: string) => Promise<void>;
  getSession: NcpSessionApi["getSession"];
}): Promise<NcpSessionSummary | null> {
  const normalizedSessionId = params.sessionId.trim();
  if (!normalizedSessionId) {
    return null;
  }

  let liveSession = params.sessionRegistry.getSession(normalizedSessionId);
  if (!liveSession) {
    const storedSession = await params.sessionStore.getSession(normalizedSessionId);
    if (!storedSession) {
      return null;
    }
    liveSession = await params.sessionRegistry.ensureSession(normalizedSessionId);
  }

  const nextMessage: NcpMessage = {
    ...structuredClone(params.message),
    sessionId: normalizedSessionId,
  };
  const event: NcpEndpointEvent = {
    type: NcpEventType.MessageSent,
    payload: {
      sessionId: normalizedSessionId,
      message: nextMessage,
    },
  };

  await liveSession.stateManager.dispatch(event);
  params.publisher.publish(event);
  if (liveSession.activeExecution && !liveSession.activeExecution.closed) {
    liveSession.activeExecution.publisher.publish(event);
  }
  await params.persistSession(normalizedSessionId);
  return params.getSession(normalizedSessionId);
}
