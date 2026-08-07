import {
  RUNTIME_DEFAULT_MODEL_VALUE,
  type RuntimeModelSelectionMode,
} from '@nextclaw/shared';
import type { ConfigView, ProviderModelCatalogView, ProvidersView, ProviderTemplatesView } from '@/shared/lib/api';
import type { ChatModelOption, DiscoveredChatModelOption } from '@/features/chat/types/chat-input.types';
import {
  buildProviderModelCatalog,
  composeProviderModel,
  resolveModelThinkingCapability,
  toProviderLocalModel,
} from '@/shared/lib/provider-models';

function buildRuntimeDefaultModelOption(
  label: string,
  thinkingCapability?: ChatModelOption['thinkingCapability'],
): ChatModelOption {
  return {
    value: RUNTIME_DEFAULT_MODEL_VALUE,
    modelLabel: label,
    providerLabel: '',
    isRuntimeDefault: true,
    thinkingCapability: thinkingCapability ?? null,
  };
}

export function buildNcpChatProviderModelOptions(params: {
  config: ConfigView | null;
  providersView: ProvidersView | null;
  templatesView: ProviderTemplatesView | null;
}): ChatModelOption[] {
  const seen = new Set<string>();
  return buildProviderModelCatalog({
    providersView: params.providersView ?? undefined,
    templatesView: params.templatesView ?? undefined,
    config: params.config ?? undefined,
    onlyConfigured: true,
  }).flatMap((provider) =>
    provider.models.map((model): ChatModelOption | null => {
      const value = composeProviderModel(provider.prefix, model);
      if (!value || seen.has(value)) {
        return null;
      }
      seen.add(value);
      return {
        value,
        modelLabel: model,
        providerLabel: provider.displayName,
        thinkingCapability: resolveModelThinkingCapability(provider.modelThinking, model, provider.aliases),
      };
    }),
  ).filter((option): option is ChatModelOption => option !== null).sort((left, right) => {
    const providerCompare = left.providerLabel.localeCompare(right.providerLabel);
    return providerCompare === 0 ? left.modelLabel.localeCompare(right.modelLabel) : providerCompare;
  });
}

export function buildNcpChatDiscoveredModelOptions(params: {
  catalogView: ProviderModelCatalogView | null;
  config: ConfigView | null;
  providersView: ProvidersView | null;
  templatesView: ProviderTemplatesView | null;
}): DiscoveredChatModelOption[] {
  const { catalogView, config, providersView, templatesView } = params;
  const remoteCatalog = catalogView?.providers ?? {};
  const seen = new Set<string>();
  return buildProviderModelCatalog({
    providersView: providersView ?? undefined,
    templatesView: templatesView ?? undefined,
    config: config ?? undefined,
  }).flatMap((provider) => {
    if (!provider.configured) {
      return [];
    }
    const configuredModels = new Set(provider.models);
    return (remoteCatalog[provider.name]?.models ?? []).map((remoteModel): DiscoveredChatModelOption | null => {
      const providerModel = toProviderLocalModel(remoteModel, provider.aliases);
      const value = composeProviderModel(provider.prefix, providerModel);
      if (!providerModel || !value || configuredModels.has(providerModel) || seen.has(value)) {
        return null;
      }
      seen.add(value);
      return {
        value,
        providerId: provider.name,
        providerModel,
        modelLabel: providerModel,
        providerLabel: provider.displayName,
        thinkingCapability: resolveModelThinkingCapability(
          provider.modelThinking,
          providerModel,
          provider.aliases,
        ),
      };
    }).filter((option): option is DiscoveredChatModelOption => option !== null);
  });
}

export function filterNcpChatDiscoveredModelOptionsBySessionType(params: {
  modelOptions: DiscoveredChatModelOption[];
  modelSelectionMode?: RuntimeModelSelectionMode;
  supportedModels?: string[];
}): DiscoveredChatModelOption[] {
  const { modelOptions, modelSelectionMode, supportedModels } = params;
  if (modelSelectionMode === 'runtime-default') {
    return [];
  }
  if (!supportedModels || supportedModels.length === 0) {
    return modelOptions;
  }
  const supportedModelSet = new Set(supportedModels);
  return modelOptions.filter((option) => supportedModelSet.has(option.value));
}

export function filterNcpChatModelOptionsBySessionType(params: {
  modelOptions: ChatModelOption[];
  modelSelectionMode?: RuntimeModelSelectionMode;
  runtimeDefaultThinkingCapability?: ChatModelOption['thinkingCapability'];
  runtimeDefaultModelLabel?: string;
  supportedModels?: string[];
}): ChatModelOption[] {
  const {
    modelOptions,
    modelSelectionMode,
    runtimeDefaultThinkingCapability,
    runtimeDefaultModelLabel = 'Runtime default',
    supportedModels,
  } = params;
  const runtimeDefaultOption = buildRuntimeDefaultModelOption(
    runtimeDefaultModelLabel,
    runtimeDefaultThinkingCapability,
  );
  if (modelSelectionMode === 'runtime-default') {
    return [runtimeDefaultOption];
  }
  if (!supportedModels || supportedModels.length === 0) {
    return modelSelectionMode === 'optional'
      ? [runtimeDefaultOption, ...modelOptions]
      : modelOptions;
  }
  const supportedModelSet = new Set(supportedModels);
  const filtered = modelOptions.filter((option) => supportedModelSet.has(option.value));
  const resolved = filtered.length > 0 ? filtered : modelOptions;
  return modelSelectionMode === 'optional'
    ? [runtimeDefaultOption, ...resolved]
    : resolved;
}
