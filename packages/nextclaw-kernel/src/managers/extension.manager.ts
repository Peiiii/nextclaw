import type { ExtensionRegistry } from "@nextclaw/core";
import {
  getPluginChannelBindings,
  getPluginUiMetadataFromRegistry,
  mergePluginConfigView,
  resolvePluginChannelMessageToolHints,
  toPluginConfigView,
  type PluginChannelBinding,
  type PluginRegistry,
  type PluginUiMetadata,
} from "@nextclaw/openclaw-compat";
import type { NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import type { Config } from "@nextclaw/core";

export type AgentRuntimeContribution = {
  pluginId: string;
  kind: string;
  label: string;
  createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
  createRuntimeForEntry?: (params: {
    entry: {
      id: string;
      label: string;
      type: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
    };
    runtimeParams: RuntimeFactoryParams;
  }) => NcpAgentRuntime;
  describeSessionType?: (params?: {
    describeMode?: "observation" | "probe";
  }) =>
    | Promise<Record<string, unknown> | null | undefined>
    | Record<string, unknown>
    | null
    | undefined;
  describeSessionTypeForEntry?: (params: {
    entry: {
      id: string;
      label: string;
      type: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
    };
    describeParams?: { describeMode?: "observation" | "probe" };
  }) =>
    | Promise<Record<string, unknown> | null | undefined>
    | Record<string, unknown>
    | null
    | undefined;
  source?: string;
};

export type NextclawExtensionRegistry = ExtensionRegistry & {
  ncpAgentRuntimes: AgentRuntimeContribution[];
};

export type ExtensionContributions = {
  registry: PluginRegistry;
  extensionRegistry: NextclawExtensionRegistry;
  channelBindings?: PluginChannelBinding[];
  uiMetadata?: PluginUiMetadata[];
};

function createEmptyExtensionRegistry(): NextclawExtensionRegistry {
  return {
    tools: [],
    channels: [],
    ncpAgentRuntimes: [],
    diagnostics: [],
  };
}

export class ExtensionManager {
  private pluginRegistry: PluginRegistry | null = null;
  private extensionRegistry: NextclawExtensionRegistry = createEmptyExtensionRegistry();
  private channelBindings: PluginChannelBinding[] = [];
  private uiMetadata: PluginUiMetadata[] = [];

  loadContributions = (contributions: ExtensionContributions): void => {
    this.pluginRegistry = contributions.registry;
    this.extensionRegistry = contributions.extensionRegistry;
    this.channelBindings =
      contributions.channelBindings ?? getPluginChannelBindings(contributions.registry);
    this.uiMetadata =
      contributions.uiMetadata ?? getPluginUiMetadataFromRegistry(contributions.registry);
  };

  loadExtensionRegistry = (extensionRegistry: NextclawExtensionRegistry): void => {
    this.extensionRegistry = extensionRegistry;
  };

  getExtensionRegistry = (): NextclawExtensionRegistry => this.extensionRegistry;

  getChannelBindings = (): PluginChannelBinding[] => this.channelBindings;

  getUiMetadata = (): PluginUiMetadata[] => this.uiMetadata;

  toConfigView = (config: Config): Config =>
    toPluginConfigView(config, this.channelBindings) as Config;

  mergeConfigView = (current: Config, nextConfigView: Record<string, unknown>): Config =>
    mergePluginConfigView(current, nextConfigView, this.channelBindings);

  resolveMessageToolHints = (params: {
    channel?: string | null;
    config?: Config;
    accountId?: string | null;
  }): string[] => {
    if (!this.pluginRegistry) {
      return [];
    }
    return resolvePluginChannelMessageToolHints({
      registry: this.pluginRegistry,
      channel: params.channel,
      cfg: params.config,
      accountId: params.accountId,
    });
  };
}
