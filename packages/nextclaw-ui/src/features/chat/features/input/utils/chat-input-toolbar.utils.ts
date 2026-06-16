import type {
  ChatInlineHint,
  ChatToolbarSelect,
} from "@nextclaw/agent-chat-ui";
import type {
  ChatInputBarAdapterTexts,
  ChatModelRecord,
  ChatThinkingLevel,
} from "@/features/chat/types/chat-input-bar.types";

function formatModelOptionLabel(option: ChatModelRecord): string {
  const modelLabel = option.modelLabel.trim();
  const providerLabel = option.providerLabel.trim();
  return providerLabel ? `${providerLabel}/${modelLabel}` : modelLabel;
}

function normalizeThinkingLevels(
  levels: ChatThinkingLevel[],
): ChatThinkingLevel[] {
  const deduped: ChatThinkingLevel[] = [];
  for (const level of ["off", ...levels] as ChatThinkingLevel[]) {
    if (!deduped.includes(level)) {
      deduped.push(level);
    }
  }
  return deduped;
}

export function buildModelStateHint(params: {
  isModelOptionsLoading: boolean;
  isModelOptionsEmpty: boolean;
  onGoToProviders: () => void;
  texts: Pick<
    ChatInputBarAdapterTexts,
    "noModelOptionsLabel" | "configureProviderLabel"
  >;
}): ChatInlineHint | null {
  const {
    isModelOptionsEmpty,
    isModelOptionsLoading,
    onGoToProviders,
    texts,
  } = params;
  if (!isModelOptionsLoading && !isModelOptionsEmpty) {
    return null;
  }
  if (isModelOptionsLoading) {
    return {
      tone: "neutral",
      loading: true,
    };
  }
  return {
    tone: "warning",
    text: texts.noModelOptionsLabel,
    actionLabel: texts.configureProviderLabel,
    onAction: onGoToProviders,
  };
}

export function buildModelToolbarSelect({
  modelOptions,
  favoriteModelValues,
  recentModelValues,
  selectedModel,
  isModelOptionsLoading,
  hasModelOptions,
  onFavoriteToggle,
  onValueChange,
  texts,
}: {
  modelOptions: ChatModelRecord[];
  favoriteModelValues?: string[];
  recentModelValues?: string[];
  selectedModel: string;
  isModelOptionsLoading: boolean;
  hasModelOptions: boolean;
  onFavoriteToggle?: (value: string, favorite: boolean) => void;
  onValueChange: (value: string) => void;
  texts: Pick<
    ChatInputBarAdapterTexts,
    | "modelSelectPlaceholder"
    | "modelNoOptionsLabel"
    | "modelSearchPlaceholder"
    | "modelSearchEmptyLabel"
    | "favoriteModelsLabel"
    | "favoriteModelLabel"
    | "unfavoriteModelLabel"
    | "recentModelsLabel"
    | "allModelsLabel"
  >;
}): ChatToolbarSelect {
  const selectedModelOption = modelOptions.find(
    (option) => option.value === selectedModel,
  );
  const resolvedModelOption = selectedModelOption ?? modelOptions[0];
  const resolvedValue = hasModelOptions
    ? resolvedModelOption?.value
    : undefined;
  const modelOptionMap = new Map(
    modelOptions.map((option) => [option.value, option] as const),
  );
  const favoriteOptions = (favoriteModelValues ?? [])
    .map((value) => modelOptionMap.get(value))
    .filter((option): option is ChatModelRecord => Boolean(option));
  const favoriteValueSet = new Set(favoriteOptions.map((option) => option.value));
  const recentOptions = (recentModelValues ?? [])
    .map((value) => modelOptionMap.get(value))
    .filter(
      (option): option is ChatModelRecord =>
        option !== undefined && !favoriteValueSet.has(option.value),
    );
  const recentValueSet = new Set(recentOptions.map((option) => option.value));
  const remainingOptions = modelOptions.filter(
    (option) => !favoriteValueSet.has(option.value) && !recentValueSet.has(option.value),
  );
  const optionGroups = favoriteOptions.length > 0 || recentOptions.length > 0
    ? [
          {
            key: "favorite-models",
            label: texts.favoriteModelsLabel,
            options: favoriteOptions.map((option) => ({
              value: option.value,
              label: formatModelOptionLabel(option),
            })),
          },
          {
            key: "recent-models",
            label: texts.recentModelsLabel,
            options: recentOptions.map((option) => ({
              value: option.value,
              label: formatModelOptionLabel(option),
            })),
          },
          {
            key: "all-models",
            label: texts.allModelsLabel,
            options: remainingOptions.map((option) => ({
              value: option.value,
              label: formatModelOptionLabel(option),
            })),
          },
        ].filter((group) => group.options.length > 0)
    : undefined;

  return {
    key: "model",
    value: resolvedValue,
    placeholder: texts.modelSelectPlaceholder,
    selectedLabel: resolvedModelOption
      ? formatModelOptionLabel(resolvedModelOption)
      : undefined,
    icon: "sparkles",
    options: modelOptions.map((option) => ({
      value: option.value,
      label: formatModelOptionLabel(option),
    })),
    groups: optionGroups,
    disabled: !hasModelOptions,
    loading: isModelOptionsLoading,
    emptyLabel: texts.modelNoOptionsLabel,
    search: {
      placeholder: texts.modelSearchPlaceholder,
      emptyLabel: texts.modelSearchEmptyLabel,
    },
    optionAction: onFavoriteToggle
      ? {
          kind: "favorite",
          activeValues: favoriteOptions.map((option) => option.value),
          activeLabel: texts.unfavoriteModelLabel,
          inactiveLabel: texts.favoriteModelLabel,
          onToggle: onFavoriteToggle,
        }
      : undefined,
    onValueChange,
  };
}

export function buildThinkingToolbarSelect(params: {
  supportedLevels: ChatThinkingLevel[];
  selectedThinkingLevel: ChatThinkingLevel | null;
  defaultThinkingLevel?: ChatThinkingLevel | null;
  onValueChange: (value: ChatThinkingLevel) => void;
  texts: Pick<ChatInputBarAdapterTexts, "thinkingLabels">;
}): ChatToolbarSelect | null {
  const {
    defaultThinkingLevel,
    onValueChange,
    selectedThinkingLevel,
    supportedLevels,
    texts,
  } = params;
  if (supportedLevels.length === 0) {
    return null;
  }

  const options = normalizeThinkingLevels(supportedLevels);
  const fallback = options.includes("off") ? "off" : options[0];
  const resolvedValue =
    (selectedThinkingLevel &&
      options.includes(selectedThinkingLevel) &&
      selectedThinkingLevel) ||
    (defaultThinkingLevel &&
      options.includes(defaultThinkingLevel) &&
      defaultThinkingLevel) ||
    fallback;

  return {
    key: "thinking",
    value: resolvedValue,
    placeholder: texts.thinkingLabels[resolvedValue],
    selectedLabel: texts.thinkingLabels[resolvedValue],
    icon: "brain",
    options: options.map((level) => ({
      value: level,
      label: texts.thinkingLabels[level],
    })),
    onValueChange: (value) => onValueChange(value as ChatThinkingLevel),
  };
}
