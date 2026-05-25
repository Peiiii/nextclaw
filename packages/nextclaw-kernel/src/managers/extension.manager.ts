import { getWorkspacePath, type Config, type ExtensionChannelRegistration, type ExtensionRegistry, type MessageBus, type SessionManager } from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { EventBus, Ingress } from "@nextclaw/shared";
import {
  getPluginChannelBindings,
  getPluginUiMetadataFromRegistry,
  mergePluginConfigView,
  toPluginConfigView,
  type PluginChannelBinding,
  type PluginRegistry,
  type PluginUiMetadata,
} from "@nextclaw/openclaw-compat";
import { ExtensionRuntimeService } from "@kernel/services/extension-runtime.service.js";
import { ExtensionPluginRegistryService, type ExtensionPluginLoadProgress } from "@kernel/services/extension-plugin-registry.service.js";

type ExtensionManifestContributions = {
  channelBindings: PluginChannelBinding[];
  uiMetadata: PluginUiMetadata[];
};

type ExtensionSnapshot = {
  extensionRegistry: ExtensionRegistry;
  channelBindings: PluginChannelBinding[];
  uiMetadata: PluginUiMetadata[];
};

export type ExtensionLoadProgress = ExtensionPluginLoadProgress;

export type ExtensionLoadResult = {
  diagnostics: PluginRegistry["diagnostics"];
  totalPluginCount: number;
  loadedPluginCount: number;
  shouldRestartChannels: boolean;
};

type ExtensionManagerOptions = {
  configManager: Pick<ConfigManager, "loadConfig">;
  eventBus: Pick<EventBus, "emitEnvelope">;
  ingress: Pick<Ingress, "addHandler">;
  messageBus: Pick<MessageBus, "publishInbound">;
  sessionManager: SessionManager;
};

type ExtensionLoadParams = {
  config?: Config;
  changedPaths?: readonly string[];
  onLoadStart?: (params: { totalPluginCount: number }) => void;
  onPluginProcessed?: (params: ExtensionLoadProgress) => void;
};

function createEmptyPluginRegistry(): PluginRegistry {
  return {
    plugins: [],
    tools: [],
    channels: [],
    providers: [],
    diagnostics: [],
    resolvedTools: [],
  };
}

function buildSortedBindingSignatures(bindings: readonly PluginChannelBinding[]): `${string}:${string}`[] {
  return bindings.map((binding) => `${binding.pluginId}:${binding.channelId}` as const).sort();
}

function buildSortedExtensionChannelIds(channels: readonly ExtensionChannelRegistration[]): string[] {
  return channels
    .map((registration) => registration.channel.id)
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .sort();
}

function areSortedStringListsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readConfigPathSegment(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) {
    return null;
  }
  const [segment] = path.slice(prefix.length).split(".");
  return segment?.trim() ? segment.trim() : null;
}

function shouldRestartChannelsForExtensionReload(params: {
  changedPaths: readonly string[];
  currentSnapshot: ExtensionSnapshot;
  nextSnapshot: ExtensionSnapshot;
}): boolean {
  const { changedPaths, currentSnapshot, nextSnapshot } = params;
  const currentBindingSignatures = buildSortedBindingSignatures(currentSnapshot.channelBindings);
  const nextBindingSignatures = buildSortedBindingSignatures(nextSnapshot.channelBindings);
  if (!areSortedStringListsEqual(currentBindingSignatures, nextBindingSignatures)) {
    return true;
  }

  const currentExtensionChannelIds = buildSortedExtensionChannelIds(currentSnapshot.extensionRegistry.channels);
  const nextExtensionChannelIds = buildSortedExtensionChannelIds(nextSnapshot.extensionRegistry.channels);
  if (!areSortedStringListsEqual(currentExtensionChannelIds, nextExtensionChannelIds)) {
    return true;
  }

  const channelPluginIds = new Set<string>();
  const channelIds = new Set<string>();
  for (const binding of [...currentSnapshot.channelBindings, ...nextSnapshot.channelBindings]) {
    channelPluginIds.add(binding.pluginId);
    channelIds.add(binding.channelId);
  }

  for (const path of changedPaths) {
    const pluginId = readConfigPathSegment(path, "plugins.entries.");
    if (pluginId && channelPluginIds.has(pluginId)) {
      return true;
    }

    const channelId = readConfigPathSegment(path, "channels.");
    if (channelId && channelIds.has(channelId)) {
      return true;
    }
  }

  return false;
}

function toExtensionRegistry(pluginRegistry: PluginRegistry): ExtensionRegistry {
  return {
    tools: pluginRegistry.tools.map((tool) => ({
      extensionId: tool.pluginId,
      factory: tool.factory,
      names: tool.names,
      optional: tool.optional,
      source: tool.source,
    })),
    channels: pluginRegistry.channels.map((channel) => ({
      extensionId: channel.pluginId,
      channel: channel.channel,
      source: channel.source,
    })),
    diagnostics: pluginRegistry.diagnostics.map((diag) => ({
      level: diag.level,
      message: diag.message,
      extensionId: diag.pluginId,
      source: diag.source,
    })),
  };
}

function toManifestChannelRegistrations(
  channelBindings: PluginChannelBinding[],
): ExtensionRegistry["channels"] {
  return channelBindings.map((binding) => ({
    extensionId: binding.pluginId,
    channel: binding.channel,
    source: "extension-manifest",
  }));
}

function buildExtensionSnapshot(
  registry: PluginRegistry,
  contributions: ExtensionManifestContributions,
): ExtensionSnapshot {
  const extensionChannelIds = new Set(contributions.channelBindings.map((binding) => binding.channelId));
  const extensionPluginIds = new Set(contributions.uiMetadata.map((metadata) => metadata.id));
  const registryExtensionRegistry = toExtensionRegistry(registry);
  return {
    extensionRegistry: {
      ...registryExtensionRegistry,
      channels: [
        ...registryExtensionRegistry.channels.filter((registration) => {
          const channelId = registration.channel.id?.trim();
          return !channelId || !extensionChannelIds.has(channelId);
        }),
        ...toManifestChannelRegistrations(contributions.channelBindings),
      ],
    },
    channelBindings: [
      ...getPluginChannelBindings(registry).filter((binding) => !extensionChannelIds.has(binding.channelId)),
      ...contributions.channelBindings,
    ],
    uiMetadata: [
      ...getPluginUiMetadataFromRegistry(registry).filter((metadata) => !extensionPluginIds.has(metadata.id)),
      ...contributions.uiMetadata,
    ],
  };
}

export class ExtensionManager {
  private snapshot: ExtensionSnapshot = buildExtensionSnapshot(createEmptyPluginRegistry(), {
    channelBindings: [],
    uiMetadata: [],
  });
  private readonly runtime: ExtensionRuntimeService;
  private readonly pluginRegistry = new ExtensionPluginRegistryService();

  constructor(private readonly options: ExtensionManagerOptions) {
    this.runtime = new ExtensionRuntimeService({
      eventBus: options.eventBus,
      getConfig: options.configManager.loadConfig,
      getWorkspace: this.getWorkspace,
      ingress: options.ingress,
      messageBus: options.messageBus,
      sessionManager: options.sessionManager,
    });
  }

  load = async (params: ExtensionLoadParams): Promise<ExtensionLoadResult> => {
    const { changedPaths = [], onLoadStart, onPluginProcessed } = params;
    const config = params.config ?? this.options.configManager.loadConfig();
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    const totalPluginCount = this.pluginRegistry.discoverEnabledPluginCount({
      config,
      workspace,
    });
    onLoadStart?.({ totalPluginCount });
    let loadedPluginCount = 0;
    const registry = await this.pluginRegistry.loadProgressively({
      config,
      workspace,
      onPluginProcessed: (progress) => {
        loadedPluginCount = progress.loadedPluginCount;
        onPluginProcessed?.(progress);
      },
    });
    const contributions = await this.runtime.loadChannelContributions({
      config,
      workspace,
    });
    const currentSnapshot = this.snapshot;
    const nextSnapshot = buildExtensionSnapshot(registry, contributions);
    this.snapshot = nextSnapshot;
    return {
      diagnostics: registry.diagnostics,
      totalPluginCount,
      loadedPluginCount: loadedPluginCount || totalPluginCount,
      shouldRestartChannels: shouldRestartChannelsForExtensionReload({
        changedPaths,
        currentSnapshot,
        nextSnapshot,
      }),
    };
  };

  reloadForConfigChange = async (params: ExtensionLoadParams & {
    changedPaths: readonly string[];
  }): Promise<ExtensionLoadResult> => await this.load(params);

  registerIngressHandlers = (): void => {
    this.runtime.registerIngressHandlers();
  };

  start = async (params: { endpoint: string | null }): Promise<void> => {
    await this.runtime.start(params);
  };

  stop = async (): Promise<void> => {
    await this.runtime.stop();
  };

  getExtensionRegistry = (): ExtensionRegistry => this.snapshot.extensionRegistry;

  getChannelBindings = (): PluginChannelBinding[] => this.snapshot.channelBindings;

  getUiMetadata = (): PluginUiMetadata[] => this.snapshot.uiMetadata;

  toConfigView = (config: Config): Config =>
    toPluginConfigView(config, this.snapshot.channelBindings) as Config;

  mergeConfigView = (current: Config, nextConfigView: Record<string, unknown>): Config =>
    mergePluginConfigView(current, nextConfigView, this.snapshot.channelBindings);

  private readonly getWorkspace = (): string =>
    getWorkspacePath(this.options.configManager.loadConfig().agents.defaults.workspace);
}
