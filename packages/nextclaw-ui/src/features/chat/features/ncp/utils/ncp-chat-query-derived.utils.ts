import {
  RUNTIME_DEFAULT_MODEL_VALUE,
  type RuntimeModelSelectionMode,
} from '@nextclaw/shared';
import type { ConfigView, ProvidersView, ProviderTemplatesView } from '@/shared/lib/api';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import { buildProviderModelCatalog, composeProviderModel, resolveModelThinkingCapability } from '@/shared/lib/provider-models';

function buildRuntimeDefaultModelOption(label: string): ChatModelOption {
  return {
    value: RUNTIME_DEFAULT_MODEL_VALUE,
    modelLabel: label,
    providerLabel: '',
    isRuntimeDefault: true,
    thinkingCapability: null,
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

export function filterNcpChatModelOptionsBySessionType(params: {
  modelOptions: ChatModelOption[];
  modelSelectionMode?: RuntimeModelSelectionMode;
  runtimeDefaultModelLabel?: string;
  supportedModels?: string[];
}): ChatModelOption[] {
  const {
    modelOptions,
    modelSelectionMode,
    runtimeDefaultModelLabel = 'Runtime default',
    supportedModels,
  } = params;
  const runtimeDefaultOption = buildRuntimeDefaultModelOption(runtimeDefaultModelLabel);
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
