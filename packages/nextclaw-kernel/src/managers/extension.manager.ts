import type { Config, ExtensionRegistry } from "@nextclaw/core";
import {
  getPluginChannelBindings,
  getPluginUiMetadataFromRegistry,
  mergePluginConfigView,
  toPluginConfigView,
  type PluginChannelBinding,
  type PluginRegistry,
  type PluginUiMetadata,
} from "@nextclaw/openclaw-compat";

export type NextclawExtensionRegistry = ExtensionRegistry;

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
    diagnostics: [],
  };
}

export class ExtensionManager {
  private extensionRegistry: NextclawExtensionRegistry = createEmptyExtensionRegistry();
  private channelBindings: PluginChannelBinding[] = [];
  private uiMetadata: PluginUiMetadata[] = [];

  loadContributions = (contributions: ExtensionContributions): void => {
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
}
