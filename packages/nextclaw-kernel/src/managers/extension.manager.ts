import {
  getWorkspacePath,
  mergeExtensionConfigView,
  toExtensionConfigView,
  type Config,
  type ExtensionChannelBinding,
  type ExtensionDiagnostic,
  type ExtensionRegistry,
  type ExtensionUiMetadata,
  type MessageBus,
  type SessionManager,
} from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { ExtensionRuntimeService } from "@kernel/services/extension-runtime.service.js";
import type { EventBus, Ingress } from "@nextclaw/shared";

type ExtensionSnapshot = {
  extensionRegistry: ExtensionRegistry;
  channelBindings: ExtensionChannelBinding[];
  uiMetadata: ExtensionUiMetadata[];
};

export type ExtensionLoadProgress = {
  extensionId: string;
  loadedExtensionCount: number;
  totalExtensionCount: number;
};

export type ExtensionLoadResult = {
  diagnostics: ExtensionDiagnostic[];
  totalExtensionCount: number;
  loadedExtensionCount: number;
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
  onLoadStart?: (params: { totalExtensionCount: number }) => void;
  onExtensionProcessed?: (params: ExtensionLoadProgress) => void;
};

function createEmptyExtensionRegistry(): ExtensionRegistry {
  return {
    tools: [],
    channels: [],
    diagnostics: [],
  };
}

function buildSortedBindingSignatures(bindings: readonly ExtensionChannelBinding[]): `${string}:${string}`[] {
  return bindings.map((binding) => `${binding.extensionId}:${binding.channelId}` as const).sort();
}

function buildSortedExtensionChannelIds(channels: readonly ExtensionRegistry["channels"][number][]): string[] {
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

function buildSnapshot(params: {
  channelBindings: ExtensionChannelBinding[];
  uiMetadata: ExtensionUiMetadata[];
}): ExtensionSnapshot {
  return {
    extensionRegistry: {
      ...createEmptyExtensionRegistry(),
      channels: params.channelBindings.map((binding) => ({
        extensionId: binding.extensionId,
        channel: binding.channel,
        source: "extension-manifest",
      })),
    },
    channelBindings: params.channelBindings,
    uiMetadata: params.uiMetadata,
  };
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

  const channelIds = new Set<string>();
  for (const binding of [...currentSnapshot.channelBindings, ...nextSnapshot.channelBindings]) {
    channelIds.add(binding.channelId);
  }

  for (const path of changedPaths) {
    const channelId = readConfigPathSegment(path, "channels.");
    if (channelId && channelIds.has(channelId)) {
      return true;
    }
    if (path.startsWith("extensions.")) {
      return true;
    }
  }

  return false;
}

function countExtensionIds(bindings: readonly ExtensionChannelBinding[], metadata: readonly ExtensionUiMetadata[]): number {
  return new Set([
    ...bindings.map((binding) => binding.extensionId),
    ...metadata.map((item) => item.id),
  ]).size;
}

export class ExtensionManager {
  private snapshot: ExtensionSnapshot = buildSnapshot({
    channelBindings: [],
    uiMetadata: [],
  });
  private readonly runtime: ExtensionRuntimeService;

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

  load = async (params: ExtensionLoadParams = {}): Promise<ExtensionLoadResult> => {
    const { changedPaths = [], onLoadStart, onExtensionProcessed } = params;
    const config = params.config ?? this.options.configManager.loadConfig();
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    const contributions = await this.runtime.loadChannelContributions({
      config,
      workspace,
    });
    const totalExtensionCount = countExtensionIds(contributions.channelBindings, contributions.uiMetadata);
    onLoadStart?.({ totalExtensionCount });
    for (const [index, binding] of contributions.channelBindings.entries()) {
      onExtensionProcessed?.({
        extensionId: binding.extensionId,
        loadedExtensionCount: index + 1,
        totalExtensionCount,
      });
    }
    const currentSnapshot = this.snapshot;
    const nextSnapshot = buildSnapshot(contributions);
    this.snapshot = nextSnapshot;
    return {
      diagnostics: [],
      totalExtensionCount,
      loadedExtensionCount: totalExtensionCount,
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

  getChannelBindings = (): ExtensionChannelBinding[] => this.snapshot.channelBindings;

  getUiMetadata = (): ExtensionUiMetadata[] => this.snapshot.uiMetadata;

  toConfigView = (config: Config): Config =>
    toExtensionConfigView(config) as Config;

  mergeConfigView = (current: Config, nextConfigView: Record<string, unknown>): Config =>
    mergeExtensionConfigView(current, nextConfigView);

  private readonly getWorkspace = (): string =>
    getWorkspacePath(this.options.configManager.loadConfig().agents.defaults.workspace);
}
