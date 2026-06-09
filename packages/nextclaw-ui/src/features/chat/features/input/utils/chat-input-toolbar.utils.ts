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
  if (!params.isModelOptionsLoading && !params.isModelOptionsEmpty) {
    return null;
  }
  if (params.isModelOptionsLoading) {
    return {
      tone: "neutral",
      loading: true,
    };
  }
  return {
    tone: "warning",
    text: params.texts.noModelOptionsLabel,
    actionLabel: params.texts.configureProviderLabel,
    onAction: params.onGoToProviders,
  };
}

export function buildModelToolbarSelect({
  modelOptions, recentModelValues, selectedModel, isModelOptionsLoading, hasModelOptions, onValueChange, texts,
}: {
  modelOptions: ChatModelRecord[];
  recentModelValues?: string[];
  selectedModel: string;
  isModelOptionsLoading: boolean;
  hasModelOptions: boolean;
  onValueChange: (value: string) => void;
  texts: Pick<
    ChatInputBarAdapterTexts,
    | "modelSelectPlaceholder"
    | "modelNoOptionsLabel"
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
  const recentValueSet = new Set(recentModelValues ?? []);
  const modelOptionMap = new Map(
    modelOptions.map((option) => [option.value, option] as const),
  );
  const recentOptions = (recentModelValues ?? [])
    .map((value) => modelOptionMap.get(value))
    .filter((option): option is ChatModelRecord => Boolean(option));
  const remainingOptions = modelOptions.filter(
    (option) => !recentValueSet.has(option.value),
  );
  const optionGroups =
    recentOptions.length > 0
      ? [
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
    onValueChange,
  };
}

export function buildSessionTypeToolbarSelect(params: {
  selectedSessionType?: string;
  selectedSessionTypeOption: { value: string; label: string } | null;
  sessionTypeOptions: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  canEditSessionType: boolean;
  shouldShow: boolean;
  texts: Pick<ChatInputBarAdapterTexts, "sessionTypePlaceholder">;
}): ChatToolbarSelect | null {
  if (!params.shouldShow) {
    return null;
  }

  return {
    key: "session-type",
    value: params.selectedSessionType,
    placeholder: params.texts.sessionTypePlaceholder,
    selectedLabel: params.selectedSessionTypeOption?.label,
    options: params.sessionTypeOptions.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    disabled: !params.canEditSessionType,
    onValueChange: params.onValueChange,
  };
}

export function buildThinkingToolbarSelect(params: {
  supportedLevels: ChatThinkingLevel[];
  selectedThinkingLevel: ChatThinkingLevel | null;
  defaultThinkingLevel?: ChatThinkingLevel | null;
  onValueChange: (value: ChatThinkingLevel) => void;
  texts: Pick<ChatInputBarAdapterTexts, "thinkingLabels">;
}): ChatToolbarSelect | null {
  if (params.supportedLevels.length === 0) {
    return null;
  }

  const options = normalizeThinkingLevels(params.supportedLevels);
  const fallback = options.includes("off") ? "off" : options[0];
  const resolvedValue =
    (params.selectedThinkingLevel &&
      options.includes(params.selectedThinkingLevel) &&
      params.selectedThinkingLevel) ||
    (params.defaultThinkingLevel &&
      options.includes(params.defaultThinkingLevel) &&
      params.defaultThinkingLevel) ||
    fallback;

  return {
    key: "thinking",
    value: resolvedValue,
    placeholder: params.texts.thinkingLabels[resolvedValue],
    selectedLabel: params.texts.thinkingLabels[resolvedValue],
    icon: "brain",
    options: options.map((level) => ({
      value: level,
      label: params.texts.thinkingLabels[level],
    })),
    onValueChange: (value) => params.onValueChange(value as ChatThinkingLevel),
  };
}
