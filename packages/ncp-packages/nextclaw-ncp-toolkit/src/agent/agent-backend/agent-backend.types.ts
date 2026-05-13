import type {
  NcpAgentConversationStateManager,
  NcpAgentRunInput,
  NcpAgentRuntime,
  NcpEndpointEvent,
  NcpMessage,
  NcpRequestEnvelope,
  NcpSessionSummary,
  OpenAITool,
} from "@nextclaw/ncp";
import type { EventPublisher } from "./event-publisher.js";

export type RuntimeFactoryParams = {
  sessionId: string;
  agentId?: string;
  stateManager: NcpAgentConversationStateManager;
  sessionMetadata: Record<string, unknown>;
  setSessionMetadata: (nextMetadata: Record<string, unknown>) => void;
  resolveAssetContentPath?: (assetUri: string) => string | null;
  resolveTools?: (input: NcpAgentRunInput) => ReadonlyArray<OpenAITool> | undefined;
};

export type CreateRuntimeFn = (params: RuntimeFactoryParams) => NcpAgentRuntime;

export type AgentSessionRecord = {
  sessionId: string;
  agentId?: string;
  messages: NcpMessage[];
  createdAt?: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type AgentSessionEventRecord = {
  sessionId: string;
  agentId?: string;
  createdAt?: string;
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
  createdAt: string;
  runtime: NcpAgentRuntime;
  stateManager: NcpAgentConversationStateManager;
  metadata: Record<string, unknown>;
  publisher: EventPublisher;
  activeExecution: LiveSessionExecution | null;
};

export interface AgentSessionStore {
  getSession(sessionId: string): Promise<AgentSessionRecord | null>;
  listSessions(): Promise<AgentSessionRecord[]>;
  getSessionSummary?(sessionId: string): Promise<NcpSessionSummary | null>;
  listSessionSummaries?(): Promise<NcpSessionSummary[]>;
  listSessionMessages?(sessionId: string): Promise<NcpMessage[]>;
  appendSessionEvent?(params: {
    session: AgentSessionEventRecord;
    event: NcpEndpointEvent;
    updatedAt: string;
  }): Promise<void>;
  saveSession(session: AgentSessionRecord): Promise<void>;
  replaceSession(session: AgentSessionRecord): Promise<void>;
  deleteSession(sessionId: string): Promise<AgentSessionRecord | null>;
}
