import type {
  NcpMessage,
  NcpTool,
} from "@nextclaw/ncp";

export type ThinkingEffort = string;

export type ContextBlock = string;

export type AgentRunRequest = {
  sessionId?: string;
  message: NcpMessage;
  agentRuntimeId?: string;
  agentId?: string;
  projectRoot?: string;
  channel?: string;
  correlationId?: string;
  model?: string;
  maxTokens?: number;
  thinkingEffort?: ThinkingEffort | null;
};

export type AgentRunAbortRequest = {
  sessionId: string;
  runId?: string;
  correlationId?: string;
};

export type AgentRunSpec = {
  runId: string;
  model: string;
  maxTokens: number;
  thinkingEffort?: ThinkingEffort | null;
};

export type ContextProvider = {
  provide: (
    request: AgentRunRequest,
  ) => Promise<readonly ContextBlock[]> | readonly ContextBlock[];
};

export type ToolProvider = {
  provide: (
    request: AgentRunRequest,
  ) => Promise<readonly NcpTool[]> | readonly NcpTool[];
};
