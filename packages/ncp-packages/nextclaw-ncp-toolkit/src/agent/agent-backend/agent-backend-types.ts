import type {
  NcpAgentConversationStateManager,
  NcpAgentRuntime,
  NcpMessage,
  NcpRequestEnvelope,
} from "@nextclaw/ncp";
import type { EventPublisher } from "./event-publisher.js";

export type RuntimeFactoryParams = {
  sessionId: string;
  agentId?: string;
  stateManager: NcpAgentConversationStateManager;
  sessionMetadata: Record<string, unknown>;
  setSessionMetadata: (nextMetadata: Record<string, unknown>) => void;
};

export type CreateRuntimeFn = (params: RuntimeFactoryParams) => NcpAgentRuntime;

export type AgentSessionRecord = {
  sessionId: string;
  agentId?: string;
  messages: NcpMessage[];
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type LiveSessionExecution = {
  controller: AbortController;
  requestEnvelope: NcpRequestEnvelope;
  abortHandled: boolean;
  closed: boolean;
};

export type LiveSessionState = {
  sessionId: string;
  agentId?: string;
  runtime: NcpAgentRuntime;
  stateManager: NcpAgentConversationStateManager;
  metadata: Record<string, unknown>;
  publisher: EventPublisher;
  activeExecution: LiveSessionExecution | null;
};

export interface AgentSessionStore {
  getSession(sessionId: string): Promise<AgentSessionRecord | null>;
  listSessions(): Promise<AgentSessionRecord[]>;
  saveSession(session: AgentSessionRecord): Promise<void>;
  replaceSession(session: AgentSessionRecord): Promise<void>;
  deleteSession(sessionId: string): Promise<AgentSessionRecord | null>;
}
