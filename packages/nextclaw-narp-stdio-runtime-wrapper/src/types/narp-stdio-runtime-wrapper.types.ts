import type {
  NcpAgentRuntime,
  NcpProviderRuntimeRoute,
  OpenAITool,
} from "@nextclaw/ncp";

export type NarpStdioPromptMeta = {
  correlationId?: string;
  providerRoute?: NcpProviderRuntimeRoute;
  sessionMetadataPatch?: Record<string, unknown>;
  sessionMetadata?: Record<string, unknown>;
  tools?: ReadonlyArray<OpenAITool>;
};

export type NarpStdioRuntimeWrapperContext = {
  sessionId: string;
  cwd?: string;
  modelId?: string;
  promptMeta: NarpStdioPromptMeta;
  setSessionMetadata?: (nextMetadata: Record<string, unknown>) => void | Promise<void>;
};

export type NarpStdioRuntimeWrapperConfig = {
  agentName: string;
  createRuntime: (
    context: NarpStdioRuntimeWrapperContext,
  ) => NcpAgentRuntime | Promise<NcpAgentRuntime>;
};
