import type {
  NcpLLMApiInput,
  NcpMessage,
  NcpTool,
} from "@nextclaw/ncp";

export type DefaultNcpAgentRunSpec = {
  runId: string;
  agentId: string;
  model: string;
  maxTokens?: number;
  thinkingEffort?: string | null;
  correlationId?: string;
};

export type AgentModelInputBuildRequest = {
  spec: DefaultNcpAgentRunSpec;
  sessionId: string;
  messages: readonly NcpMessage[];
  contextBlocks: readonly string[];
  tools: readonly NcpTool[];
};

export interface AgentModelInputBuilder {
  build(request: AgentModelInputBuildRequest): Promise<NcpLLMApiInput>;
}
