import type {
  NcpAgentConversationStateManager,
  NcpAgentRunInput,
} from "@nextclaw/ncp";

export type ClaudeCodeMessage = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  session_id?: string;
  message?: {
    content?: unknown;
  };
  event?: unknown;
  result?: unknown;
  errors?: unknown;
  error?: unknown;
};

export type ClaudeCodeQuery = AsyncIterable<ClaudeCodeMessage> & {
  close?: () => void;
  initializationResult?: () => Promise<{
    account?: unknown;
    models?: Array<{
      value?: string;
      displayName?: string;
      description?: string;
    }>;
  }>;
  supportedModels?: () => Promise<Array<{
    value?: string;
    displayName?: string;
    description?: string;
  }>>;
};

export type ClaudeCodeQueryOptions = {
  abortController?: AbortController;
  cwd?: string;
  model?: string;
  env?: Record<string, string | undefined>;
  resume?: string;
  [key: string]: unknown;
};

export type ClaudeCodeSdkModule = {
  query: (params: {
    prompt: string;
    options?: ClaudeCodeQueryOptions;
  }) => ClaudeCodeQuery;
  unstable_v2_createSession?: (options: ClaudeCodeQueryOptions & {
    model: string;
    executable?: string;
    executableArgs?: string[];
    pathToClaudeCodeExecutable?: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    permissionMode?: string;
    persistSession?: boolean;
  }) => {
    close: () => void;
    query?: {
      initializationResult?: ClaudeCodeQuery["initializationResult"];
      supportedModels?: ClaudeCodeQuery["supportedModels"];
    };
  };
};

export type TextStreamState = {
  emittedText: string;
  textStarted: boolean;
};

export type ClaudeCodeLoader = {
  loadClaudeCodeSdkModule: () => Promise<ClaudeCodeSdkModule>;
};

export type ClaudeCodeSdkAnthropicGatewayConfig = {
  upstreamApiBase: string;
  upstreamApiKey?: string;
};

export type ClaudeCodeSdkNcpAgentRuntimeConfig = {
  sessionId: string;
  apiKey: string;
  authToken?: string;
  apiBase?: string;
  model?: string;
  workingDirectory: string;
  sessionRuntimeId?: string | null;
  env?: Record<string, string>;
  baseQueryOptions?: Record<string, unknown>;
  requestTimeoutMs?: number;
  sessionMetadata?: Record<string, unknown>;
  setSessionMetadata?: (nextMetadata: Record<string, unknown>) => void;
  inputBuilder?: (input: NcpAgentRunInput) => Promise<string> | string;
  stateManager?: NcpAgentConversationStateManager;
  anthropicGateway?: ClaudeCodeSdkAnthropicGatewayConfig;
};
