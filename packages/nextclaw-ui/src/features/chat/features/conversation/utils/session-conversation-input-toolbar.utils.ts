import { t } from '@/shared/lib/i18n';
import {
  buildModelToolbarSelect,
  buildSkillPickerModel,
  buildThinkingToolbarSelect,
  type ChatModelRecord,
  type ChatSkillRecord,
  type ChatThinkingLevel,
} from '@/features/chat/features/input/utils/chat-input-bar.utils';

function buildThinkingLabels(): Record<ChatThinkingLevel, string> {
  return {
    off: t('chatThinkingLevelOff'),
    minimal: t('chatThinkingLevelMinimal'),
    low: t('chatThinkingLevelLow'),
    medium: t('chatThinkingLevelMedium'),
    high: t('chatThinkingLevelHigh'),
    adaptive: t('chatThinkingLevelAdaptive'),
    xhigh: t('chatThinkingLevelXhigh'),
  };
}

type ToolbarSelectBuildParams = {
  readonly allModelsLabel: string;
  readonly favoriteModelLabel: string;
  readonly favoriteModelValues: string[];
  readonly favoriteModelsLabel: string;
  readonly hasModelOptions: boolean;
  readonly isModelOptionsLoading: boolean;
  readonly modelRecords: ChatModelRecord[];
  readonly modelSearchEmptyLabel: string;
  readonly modelSearchPlaceholder: string;
  readonly onFavoriteModelToggle: (value: string, favorite: boolean) => void;
  readonly onModelChange: (value: string) => void;
  readonly onThinkingChange: (value: ChatThinkingLevel | null) => void;
  readonly recentModelValues: string[];
  readonly recentModelsLabel: string;
  readonly selectedModel: string;
  readonly selectedThinkingLevel: ChatThinkingLevel | null;
  readonly thinkingDefaultLevel: ChatThinkingLevel | null;
  readonly thinkingSupportedLevels: ChatThinkingLevel[];
  readonly unfavoriteModelLabel: string;
};

export function buildSessionConversationToolbarSelects(params: ToolbarSelectBuildParams) {
  const {
    allModelsLabel,
    favoriteModelLabel,
    favoriteModelValues,
    favoriteModelsLabel,
    hasModelOptions,
    isModelOptionsLoading,
    modelRecords,
    modelSearchEmptyLabel,
    modelSearchPlaceholder,
    onFavoriteModelToggle,
    onModelChange,
    onThinkingChange,
    recentModelValues,
    recentModelsLabel,
    selectedModel,
    selectedThinkingLevel,
    thinkingDefaultLevel,
    thinkingSupportedLevels,
    unfavoriteModelLabel,
  } = params;
  return [
    buildModelToolbarSelect({
      modelOptions: modelRecords,
      favoriteModelValues,
      recentModelValues,
      selectedModel,
      isModelOptionsLoading,
      hasModelOptions,
      onFavoriteToggle: onFavoriteModelToggle,
      onValueChange: onModelChange,
      texts: {
        modelSelectPlaceholder: t('chatSelectModel'),
        modelNoOptionsLabel: t('chatModelNoOptions'),
        modelSearchPlaceholder,
        modelSearchEmptyLabel,
        favoriteModelsLabel,
        favoriteModelLabel,
        unfavoriteModelLabel,
        recentModelsLabel,
        allModelsLabel,
      },
    }),
    buildThinkingToolbarSelect({
      supportedLevels: thinkingSupportedLevels,
      selectedThinkingLevel,
      defaultThinkingLevel: thinkingDefaultLevel,
      onValueChange: onThinkingChange,
      texts: {
        thinkingLabels: buildThinkingLabels(),
      },
    }),
  ].filter((item): item is NonNullable<typeof item> => item !== null);
}

export function buildSessionConversationSkillPicker(params: {
  readonly allSkillsLabel: string;
  readonly isSkillsLoading: boolean;
  readonly onSelectedKeysChange: (keys: string[]) => void;
  readonly recentSkillGroupValues: string[];
  readonly recentSkillValues: string[];
  readonly recentSkillsLabel: string;
  readonly skillRecords: ChatSkillRecord[];
  readonly selectedSkills: readonly string[];
}) {
  const {
    allSkillsLabel,
    isSkillsLoading,
    onSelectedKeysChange,
    recentSkillGroupValues,
    recentSkillValues,
    recentSkillsLabel,
    selectedSkills,
    skillRecords,
  } = params;
  return buildSkillPickerModel({
    skillRecords,
    recentSkillValues,
    groupedRecentSkillValues: recentSkillGroupValues,
    selectedSkills: [...selectedSkills],
    isLoading: isSkillsLoading,
    onSelectedKeysChange,
    texts: {
      title: t('chatSkillsPickerTitle'),
      searchPlaceholder: t('chatSkillsPickerSearchPlaceholder'),
      emptyLabel: t('chatSkillsPickerEmpty'),
      loadingLabel: t('sessionsLoading'),
      manageLabel: t('chatSkillsPickerManage'),
      recentSkillsLabel,
      allSkillsLabel,
    },
  });
}

export function resolveThinkingForConversationModel(
  modelOption: ChatModelRecord | undefined,
  current: ChatThinkingLevel | null,
): ChatThinkingLevel | null {
  const capability = modelOption?.thinkingCapability;
  if (!capability || capability.supported.length === 0) {
    return null;
  }
  if (current === 'off') {
    return 'off';
  }
  if (current && capability.supported.includes(current)) {
    return current;
  }
  if (capability.default && capability.supported.includes(capability.default)) {
    return capability.default;
  }
  return 'off';
}
