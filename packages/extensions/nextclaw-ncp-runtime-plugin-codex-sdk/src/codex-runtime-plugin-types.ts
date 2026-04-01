import type {
  NcpAgentRuntime,
} from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import type { SessionTypeDescriptor } from "./codex-session-type.js";

export type CodexReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type ResolvedProviderSpec = {
  isGateway?: boolean;
  isLocal?: boolean;
  supportsResponsesApi?: boolean;
};

export type ResolvedProviderConfig = {
  wireApi?: string | null;
  extraHeaders?: Record<string, string> | null;
};

export type ResolvedProviderRuntime = {
  resolvedModel: string;
  providerLocalModel: string;
  provider: ResolvedProviderConfig | null;
  providerName: string | null;
  providerDisplayName: string | null;
  providerSpec: ResolvedProviderSpec | null;
  apiKey: string | null;
  apiBase: string | null;
};

export type AgentRuntimeApi = {
  defaults: {
    workspace?: string;
    model?: string;
  };
  resolveWorkspacePath: (workspace?: string) => string;
  resolveSessionWorkspacePath: (params: {
    sessionMetadata?: Record<string, unknown>;
    workspace?: string;
  }) => string;
  resolveProviderRuntime: (model?: string) => ResolvedProviderRuntime;
  buildRuntimeUserPrompt: (params: {
    workspace?: string;
    hostWorkspace?: string;
    sessionKey?: string;
    metadata?: Record<string, unknown>;
    userMessage: string;
  }) => string;
};

export type PluginApi = {
  config?: Record<string, unknown>;
  pluginConfig?: Record<string, unknown>;
  runtime: {
    agent: AgentRuntimeApi;
  };
  registerNcpAgentRuntime: (registration: {
    kind: string;
    label?: string;
    createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
    describeSessionType?:
      | (() => Promise<SessionTypeDescriptor | null | undefined>)
      | (() => SessionTypeDescriptor | null | undefined);
  }) => void;
};

export type PluginDefinition = {
  id: string;
  name: string;
  description: string;
  configSchema: Record<string, unknown>;
  register: (api: PluginApi) => void;
};
