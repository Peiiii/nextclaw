import type { Config } from "@nextclaw/core";
import type { PluginChannelBinding } from "@nextclaw/openclaw-compat";
import { resolveChannelConfigView } from "./channel-config-view.js";
import {
  ExtensionManifestDiscoveryService,
  type ExtensionManifest,
} from "../../shared/services/extensions/extension-lifecycle.service.js";
import {
  resolveExtensionManifestRoots,
} from "../../shared/services/extensions/service-extension-runtime.service.js";

export type ChannelListEntry = {
  id: string;
  label: string;
  pluginId: string;
  enabled: boolean;
  outbound: {
    text: boolean;
  };
  auth: {
    login: boolean;
  };
  defaultAccountId?: string;
};

export type ChannelListOutput = {
  channels: ChannelListEntry[];
};

type ChannelListSource = {
  id: string;
  label: string;
  pluginId: string;
  outboundText: boolean;
  login: boolean;
  resolveDefaultAccountId?: (channelConfig: Record<string, unknown> | undefined) => string | undefined;
};

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export class ChannelListViewService {
  constructor(
    private readonly params: {
      channelLabels: Record<string, string>;
    },
  ) {}

  build = (params: {
    config: Config;
    workspaceDir: string;
    pluginBindings: PluginChannelBinding[];
  }): ChannelListOutput => {
    const { config, pluginBindings, workspaceDir } = params;
    const sources = this.mergeChannelSources(
      pluginBindings.map(this.toPluginChannelSource),
      this.toManifestChannelSources(this.discoverExtensionManifests(config, workspaceDir)),
    );
    const channelConfig = resolveChannelConfigView(config, pluginBindings);
    const channelConfigs = readRecord(channelConfig.channels) ?? {};
    return {
      channels: sources
        .map((source) => this.toChannelListEntry(source, channelConfigs[source.id]))
        .sort((left, right) => left.id.localeCompare(right.id))
    };
  };

  private toManifestChannelSources = (manifests: ExtensionManifest[]): ChannelListSource[] => {
    const sources: ChannelListSource[] = [];
    for (const manifest of manifests) {
      const channels = manifest.contributes?.channels ?? [];
      for (const channel of channels) {
        const channelId = readString(channel.id);
        if (!channelId) {
          continue;
        }
        sources.push({
          pluginId: manifest.id,
          id: channelId,
          label: readString(channel.name) ?? this.params.channelLabels[channelId] ?? channelId,
          outboundText: channel.outbound?.text === true,
          login: Boolean(channel.auth),
        });
      }
    }
    return sources;
  };

  private toPluginChannelSource = (binding: PluginChannelBinding): ChannelListSource => ({
    id: binding.channelId,
    label: readString(binding.channel.meta?.label) ?? this.params.channelLabels[binding.channelId] ?? binding.channelId,
    pluginId: binding.pluginId,
    outboundText: typeof binding.channel.outbound?.sendText === "function",
    login: typeof binding.channel.auth?.login === "function",
    resolveDefaultAccountId: (channelConfig) => this.resolveDefaultAccountId(binding, channelConfig),
  });

  private toChannelListEntry = (source: ChannelListSource, rawChannelConfig: unknown): ChannelListEntry => {
    const channelConfig = readRecord(rawChannelConfig);
    const defaultAccountId = readString(channelConfig?.defaultAccountId) ?? source.resolveDefaultAccountId?.(channelConfig);
    return {
      id: source.id,
      label: source.label,
      pluginId: source.pluginId,
      enabled: channelConfig?.enabled === true,
      outbound: {
        text: source.outboundText,
      },
      auth: {
        login: source.login,
      },
      ...(defaultAccountId ? { defaultAccountId } : {})
    };
  };

  private mergeChannelSources = (
    pluginSources: ChannelListSource[],
    extensionSources: ChannelListSource[],
  ): ChannelListSource[] => {
    const sourcesByChannelId = new Map<string, ChannelListSource>();
    for (const source of [...pluginSources, ...extensionSources]) {
      sourcesByChannelId.set(source.id, source);
    }
    return [...sourcesByChannelId.values()];
  };

  private discoverExtensionManifests = (
    config: Config,
    workspaceDir: string,
  ): ExtensionManifest[] => {
    const discovery = new ExtensionManifestDiscoveryService();
    const roots = resolveExtensionManifestRoots({
      config,
      workspace: workspaceDir,
    });
    return discovery.discoverSync(roots);
  };

  private resolveDefaultAccountId = (
    binding: PluginChannelBinding,
    channelConfig: Record<string, unknown> | undefined,
  ): string | undefined => {
    const configAdapter = binding.channel.config?.defaultAccountId;
    if (!configAdapter) {
      return undefined;
    }
    try {
      return readString(configAdapter({ channels: { [binding.channelId]: channelConfig ?? {} } }));
    } catch {
      return undefined;
    }
  };
}
