import type { Config } from "@nextclaw/core";
import type { NcpAgentRunInput, NcpEndpointEvent } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import type {
  PluginConfigUiHint,
  PluginDiagnostic,
  PluginOrigin,
  PluginRecord,
} from "@nextclaw/openclaw-compat";

export type ExtensionHostToolDescriptor = {
  registrationId: string;
  pluginId: string;
  source: string;
  names: string[];
  optional: boolean;
  previews: Array<{
    name: string;
    label?: string;
    description?: string;
    parameters: Record<string, unknown>;
  }>;
};

export type ExtensionHostChannelDescriptor = {
  pluginId: string;
  source: string;
  channel: {
    id: string;
    meta?: Record<string, unknown>;
    capabilities?: Record<string, unknown>;
    configSchema?: {
      schema: Record<string, unknown>;
      uiHints?: Record<string, PluginConfigUiHint>;
    };
    hasOutboundText: boolean;
    hasOutboundPayload: boolean;
  };
};

export type ExtensionHostRuntimeDescriptor = {
  registrationId: string;
  pluginId: string;
  source: string;
  kind: string;
  label: string;
  supportsEntryRuntime: boolean;
  supportsEntryDescription: boolean;
};

export type ExtensionHostSnapshot = {
  plugins: PluginRecord[];
  diagnostics: PluginDiagnostic[];
  tools: ExtensionHostToolDescriptor[];
  channels: ExtensionHostChannelDescriptor[];
  ncpAgentRuntimes: ExtensionHostRuntimeDescriptor[];
};

export type ExtensionHostLoadRequest = {
  config: Config;
  workspaceDir: string;
};

export type ExtensionHostLoadProgress = {
  loadedPluginCount: number;
  totalPluginCount: number;
  pluginId?: string;
};

export type ExtensionHostToolExecuteRequest = {
  registrationId: string;
  alias: string;
  context: {
    config?: Config;
    workspaceDir?: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    sandboxed?: boolean;
  };
  params: Record<string, unknown>;
  toolCallId?: string;
};

export type ExtensionHostChannelOutboundRequest = {
  pluginId: string;
  channelId: string;
  kind: "text" | "payload";
  cfg: Config;
  to: string;
  text: string;
  accountId?: string | null;
  payload?: unknown;
};

export type ExtensionHostStartGatewaysRequest = {
  config: Config;
};

export type ExtensionHostRuntimeDescribeRequest = {
  kind: string;
  entry?: {
    id: string;
    label: string;
    type: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  };
  describeParams?: {
    describeMode?: "observation" | "probe";
  };
};

export type ExtensionHostRuntimeRunRequest = {
  streamId: string;
  kind: string;
  entry?: ExtensionHostRuntimeDescribeRequest["entry"];
  runtimeParams: Pick<RuntimeFactoryParams, "sessionId" | "agentId" | "sessionMetadata">;
  input: NcpAgentRunInput;
};

export type ExtensionHostMessage =
  | { type: "request"; id: number; method: "load"; payload: ExtensionHostLoadRequest }
  | { type: "request"; id: number; method: "tool.execute"; payload: ExtensionHostToolExecuteRequest }
  | { type: "request"; id: number; method: "channel.startGateways"; payload: ExtensionHostStartGatewaysRequest }
  | { type: "request"; id: number; method: "channel.stopGateways"; payload?: undefined }
  | { type: "request"; id: number; method: "channel.outbound"; payload: ExtensionHostChannelOutboundRequest }
  | { type: "request"; id: number; method: "runtime.describe"; payload: ExtensionHostRuntimeDescribeRequest }
  | { type: "request"; id: number; method: "runtime.run"; payload: ExtensionHostRuntimeRunRequest }
  | { type: "request"; id: number; method: "runtime.abort"; payload: { streamId: string; reason?: string } }
  | { type: "response"; id: number; ok: true; payload?: unknown }
  | { type: "response"; id: number; ok: false; error: string }
  | { type: "event"; event: "load.progress"; payload: ExtensionHostLoadProgress }
  | { type: "event"; event: "runtime.event"; payload: { streamId: string; event: NcpEndpointEvent } }
  | { type: "event"; event: "runtime.metadata"; payload: { streamId: string; metadata: Record<string, unknown> } }
  | { type: "event"; event: "runtime.done"; payload: { streamId: string } }
  | { type: "event"; event: "runtime.error"; payload: { streamId: string; error: string } };

export type SerializablePluginRecord = Omit<PluginRecord, "origin"> & {
  origin: PluginOrigin;
};
