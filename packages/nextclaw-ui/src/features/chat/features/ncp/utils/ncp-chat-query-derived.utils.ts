import type { ConfigView, ProvidersView, ProviderTemplatesView } from '@/shared/lib/api';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import { buildProviderModelCatalog, composeProviderModel, resolveModelThinkingCapability } from '@/shared/lib/provider-models';

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
  supportedModels?: string[];
}): ChatModelOption[] {
  const { modelOptions, supportedModels } = params;
  if (!supportedModels || supportedModels.length === 0) {
    return modelOptions;
  }
  const supportedModelSet = new Set(supportedModels);
  const filtered = modelOptions.filter((option) => supportedModelSet.has(option.value));
  return filtered.length > 0 ? filtered : modelOptions;
}
