import { useCallback, useEffect, useMemo, useRef, type ChangeEvent, type RefObject } from 'react';
import { ChatInputBar, type ChatInputBarHandle } from '@nextclaw/agent-chat-ui';
import { DEFAULT_NCP_ATTACHMENT_MAX_BYTES, uploadFilesAsNcpDraftAttachments } from '@nextclaw/ncp-react';
import { uploadNcpAssets } from '@/shared/lib/api';
import type { SessionSkillEntryView } from '@/shared/lib/api';
import { buildModelStateHint, buildModelToolbarSelect, buildSkillPickerModel, buildThinkingToolbarSelect, type ChatModelRecord, type ChatSkillRecord, type ChatThinkingLevel } from '@/features/chat/features/input/utils/chat-input-bar.utils';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { useI18n } from '@/app/components/i18n-provider';
import { useViewportLayout } from '@/app/hooks/use-viewport-layout';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { chatRecentModelsManager, CHAT_RECENT_MODELS_MIN_OPTIONS } from '@/features/chat/managers/chat-recent-models.manager';
import { chatRecentSkillsManager, CHAT_RECENT_SKILLS_MIN_OPTIONS } from '@/features/chat/managers/chat-recent-skills.manager';
import { hasNcpChatModelOptions, isNcpChatComposerDisabled, isNcpChatModelOptionsEmpty, isNcpChatModelOptionsLoading, isNcpChatSendDisabled } from '@/features/chat/features/input/utils/ncp-chat-input-availability.utils';
import { useChatInputBarQueryState } from '@/features/chat/features/input/hooks/use-chat-input-bar-query-state';
import { useChatInputSurfaceState } from '@/features/chat/features/input/hooks/use-chat-input-surface-state';
import { useChatModelFavorites } from '@/features/chat/features/input/hooks/use-chat-model-favorites';
import { useSelectedSessionContextWindowIndicator } from '@/features/chat/features/session/hooks/use-selected-session-context-window-indicator';
import { useSystemStatus } from '@/features/system-status';
import { isNcpChatRuntimeBlocked } from '@/features/chat/features/runtime/utils/ncp-chat-runtime-availability.utils';
import { t } from '@/shared/lib/i18n';
import { toast } from 'sonner';

type ChatInputStoreSnapshot = ReturnType<typeof useChatInputStore.getState>['snapshot'];

function buildThinkingLabels(): Record<ChatThinkingLevel, string> {
  return {
    off: t('chatThinkingLevelOff'),
    minimal: t('chatThinkingLevelMinimal'),
    low: t('chatThinkingLevelLow'),
    medium: t('chatThinkingLevelMedium'),
    high: t('chatThinkingLevelHigh'),
    adaptive: t('chatThinkingLevelAdaptive'),
    xhigh: t('chatThinkingLevelXhigh')
  };
}
function toSkillRecords(
  snapshotRecords: SessionSkillEntryView[],
  scopeLabels: Record<SessionSkillEntryView['scope'], string>
): ChatSkillRecord[] {
  return snapshotRecords.map((record) => ({
    key: record.ref,
    label: record.name,
    scopeLabel: scopeLabels[record.scope],
    description: record.description,
    descriptionZh: record.descriptionZh,
    badgeLabel: scopeLabels[record.scope]
  }));
}
function toModelRecords(snapshotModels: Array<{
  value: string;
  modelLabel: string;
  providerLabel: string;
  thinkingCapability?: {
    supported: string[];
    default?: string | null;
  } | null;
}>): ChatModelRecord[] {
  return snapshotModels.map((model) => ({
    value: model.value,
    modelLabel: model.modelLabel,
    providerLabel: model.providerLabel,
    thinkingCapability: model.thinkingCapability
      ? {
          supported: model.thinkingCapability.supported as ChatThinkingLevel[],
          default: (model.thinkingCapability.default as ChatThinkingLevel | null | undefined) ?? null
        }
      : null
  }));
}
function useChatInputBarLabels(language: string) {
  const skillScopeLabels = useMemo<Record<'builtin' | 'project' | 'workspace', string>>(() => {
    void language;
    return {
      builtin: t('chatSkillScopeBuiltin'),
      project: t('chatSkillScopeProject'),
      workspace: t('chatSkillScopeWorkspace')
    };
  }, [language]);
  const slashTexts = useMemo(() => {
    void language;
    return {
      slashSkillSubtitle: t('chatSlashTypeSkill'),
      slashSkillSpecLabel: t('chatSlashSkillSpec'),
      slashSkillScopeLabel: t('chatSlashSkillScope'),
      noSkillDescription: t('chatSkillsPickerNoDescription')
    };
  }, [language]);
  return {
    skillScopeLabels,
    slashTexts,
    recentModelsLabel: t('chatPickerRecentModels'),
    allModelsLabel: t('chatPickerAllModels'),
    favoriteModelsLabel: t('chatPickerFavoriteModels'),
    modelSearchPlaceholder: t('chatModelSearchPlaceholder'),
    modelSearchEmptyLabel: t('chatModelSearchEmpty'),
    favoriteModelLabel: t('chatFavoriteModel'),
    unfavoriteModelLabel: t('chatUnfavoriteModel'),
    recentSkillsLabel: t('chatPickerRecent'),
    allSkillsLabel: t('chatPickerAllSkills')
  };
}
function useChatInputBarCollections(params: {
  modelOptions: ChatInputStoreSnapshot['modelOptions'];
  skillRecords: SessionSkillEntryView[];
  skillScopeLabels: Record<'builtin' | 'project' | 'workspace', string>;
}) {
  const skillRecords = useMemo(
    () => toSkillRecords(params.skillRecords, params.skillScopeLabels),
    [params.skillRecords, params.skillScopeLabels]
  );
  const modelRecords = useMemo(() => toModelRecords(params.modelOptions), [params.modelOptions]);
  return {
    skillRecords,
    modelRecords,
    recentModelValues: chatRecentModelsManager.resolveVisible({
      availableValues: modelRecords.map((option) => option.value),
      minAvailableCount: CHAT_RECENT_MODELS_MIN_OPTIONS
    }),
    recentSkillValues: chatRecentSkillsManager.resolveVisible({
      availableValues: skillRecords.map((record) => record.key),
      minAvailableCount: 0
    }),
    recentSkillGroupValues: chatRecentSkillsManager.resolveVisible({
      availableValues: skillRecords.map((record) => record.key),
      minAvailableCount: CHAT_RECENT_SKILLS_MIN_OPTIONS
    })
  };
}
function useChatInputBarAttachments(params: { attachmentSupported: boolean; inputBarRef: RefObject<ChatInputBarHandle | null>; }) {
  const { attachmentSupported, inputBarRef } = params;
  const presenter = usePresenter();
  const showAttachmentError = useCallback((reason: 'unsupported-type' | 'too-large' | 'read-failed') => {
    if (reason === 'unsupported-type') {
      toast.error(t('chatInputAttachmentUnsupported'));
      return;
    }
    if (reason === 'too-large') {
      toast.error(
        t('chatInputAttachmentTooLarge').replace('{maxMb}', String(DEFAULT_NCP_ATTACHMENT_MAX_BYTES / (1024 * 1024)))
      );
      return;
    }
    toast.error(t('chatInputAttachmentReadFailed'));
  }, []);
  const handleFilesAdd = useCallback(async (files: File[]) => {
    if (!attachmentSupported || files.length === 0) {
      return;
    }
    const result = await uploadFilesAsNcpDraftAttachments(files, { uploadBatch: uploadNcpAssets });
    if (result.attachments.length > 0) {
      const insertedAttachments = presenter.chatInputManager.addAttachments?.(result.attachments) ?? [];
      if (insertedAttachments.length > 0) {
        inputBarRef.current?.insertFileTokens(
          insertedAttachments.map((attachment) => ({ tokenKey: attachment.id, label: attachment.name }))
        );
      }
    }
    if (result.rejected.length > 0) {
      showAttachmentError(result.rejected[0].reason);
    }
  }, [attachmentSupported, inputBarRef, presenter.chatInputManager, showAttachmentError]);
  return {
    handleFilesAdd,
    handleFileInputChange: useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.currentTarget.value = '';
      await handleFilesAdd(files);
    }, [handleFilesAdd])
  };
}

type ToolbarSelectBuildParams = {
  allModelsLabel: string;
  favoriteModelLabel: string;
  favoriteModelValues: string[];
  favoriteModelsLabel: string;
  hasModelOptions: boolean;
  isModelOptionsLoading: boolean;
  modelRecords: ChatModelRecord[];
  modelSearchEmptyLabel: string;
  modelSearchPlaceholder: string;
  onFavoriteModelToggle: (value: string, favorite: boolean) => void;
  onModelChange: (value: string) => void;
  onThinkingChange: (value: ChatThinkingLevel | null) => void;
  recentModelValues: string[];
  recentModelsLabel: string;
  selectedModel: string;
  selectedThinkingLevel: ChatThinkingLevel | null;
  thinkingDefaultLevel: ChatThinkingLevel | null;
  thinkingSupportedLevels: ChatThinkingLevel[];
  unfavoriteModelLabel: string;
};

function buildToolbarSelects(params: ToolbarSelectBuildParams) {
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
    unfavoriteModelLabel
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
        allModelsLabel
      }
    }),
    buildThinkingToolbarSelect({
      supportedLevels: thinkingSupportedLevels,
      selectedThinkingLevel,
      defaultThinkingLevel: thinkingDefaultLevel,
      onValueChange: onThinkingChange,
      texts: {
        thinkingLabels: buildThinkingLabels()
      }
    })
  ].filter((item): item is NonNullable<typeof item> => item !== null);
}
function buildSkillPicker(params: { allSkillsLabel: string; isSkillsLoading: boolean; onSelectedKeysChange: (keys: string[]) => void; recentSkillGroupValues: string[]; recentSkillValues: string[]; recentSkillsLabel: string; skillRecords: ChatSkillRecord[]; snapshot: ChatInputStoreSnapshot; }) {
  const { allSkillsLabel, isSkillsLoading, onSelectedKeysChange, recentSkillGroupValues, recentSkillValues, recentSkillsLabel, skillRecords, snapshot } = params;
  return buildSkillPickerModel({
    skillRecords,
    recentSkillValues,
    groupedRecentSkillValues: recentSkillGroupValues,
    selectedSkills: snapshot.selectedSkills,
    isLoading: isSkillsLoading,
    onSelectedKeysChange,
    texts: {
      title: t('chatSkillsPickerTitle'),
      searchPlaceholder: t('chatSkillsPickerSearchPlaceholder'),
      emptyLabel: t('chatSkillsPickerEmpty'),
      loadingLabel: t('sessionsLoading'),
      manageLabel: t('chatSkillsPickerManage'),
      recentSkillsLabel,
      allSkillsLabel
    }
  });
}

type ChatInputBarContainerProps = {
  surface?: 'default' | 'embedded';
};

export function ChatInputBarContainer({ surface = 'default' }: ChatInputBarContainerProps) {
  const presenter = usePresenter();
  const { language } = useI18n();
  const { isMobile } = useViewportLayout();
  const snapshot = useChatInputStore((state) => state.snapshot);
  const inputQueryState = useChatInputBarQueryState(snapshot);
  const isRuntimeBlocked = isNcpChatRuntimeBlocked(useSystemStatus());
  const inputBarRef = useRef<ChatInputBarHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const labels = useChatInputBarLabels(language);
  const { skillRecords, modelRecords, recentModelValues, recentSkillValues, recentSkillGroupValues } = useChatInputBarCollections({
    modelOptions: inputQueryState.modelOptions,
    skillRecords: inputQueryState.skillRecords,
    skillScopeLabels: labels.skillScopeLabels
  });
  const { inputSurfaceState, setInputSurfaceTrigger } = useChatInputSurfaceState({
    isSkillsLoading: inputQueryState.isSkillsLoading,
    itemTexts: {
      slashTexts: labels.slashTexts
    },
    language,
    onSelectSkill: presenter.chatInputManager.rememberSkillSelection,
    recentSkillValues,
    skillRecords
  });
  const modelRecordValues = useMemo(
    () => modelRecords.map((option) => option.value),
    [modelRecords]
  );
  const {
    favoriteModelValues,
    setModelFavorite,
  } = useChatModelFavorites(modelRecordValues);
  const availabilitySnapshot = {
    ...snapshot,
    isProviderStateResolved: inputQueryState.isProviderStateResolved,
    modelOptions: inputQueryState.modelOptions
  };
  const hasModelOptions = hasNcpChatModelOptions(availabilitySnapshot);
  const isModelOptionsLoading = isNcpChatModelOptionsLoading(availabilitySnapshot);
  const isModelOptionsEmpty = isNcpChatModelOptionsEmpty(availabilitySnapshot);
  const inputDisabled = isNcpChatComposerDisabled(availabilitySnapshot);
  const attachmentSupported = typeof presenter.chatInputManager.addAttachments === 'function';
  const textareaPlaceholder = isModelOptionsEmpty
    ? t('chatModelNoOptions')
    : t(isMobile ? 'chatInputPlaceholderCompact' : 'chatInputPlaceholder');
  const contextWindowIndicator = useSelectedSessionContextWindowIndicator();
  const selectedModelOption = modelRecords.find((option) => option.value === snapshot.selectedModel);
  const thinkingSupportedLevels = selectedModelOption?.thinkingCapability?.supported ?? [];
  const resolvedStopHint = snapshot.stopDisabledReason === '__preparing__'
    ? t('chatStopPreparing')
    : snapshot.stopDisabledReason?.trim() || t('chatStopUnavailable');
  const { handleFilesAdd, handleFileInputChange } = useChatInputBarAttachments({ attachmentSupported, inputBarRef });
  useEffect(() => {
    presenter.chatInputManager.syncSnapshot({
      isProviderStateResolved: inputQueryState.isProviderStateResolved,
      modelOptions: inputQueryState.modelOptions,
      skillRecords: inputQueryState.skillRecords,
      defaultSessionType: inputQueryState.sessionTypeState.defaultSessionType,
      defaultProjectRoot: inputQueryState.defaultProjectRoot,
      sessionTypeOptions: inputQueryState.sessionTypeState.sessionTypeOptions,
      selectedSessionType: inputQueryState.sessionTypeState.selectedSessionType,
      canEditSessionType: inputQueryState.sessionTypeState.canEditSessionType,
      sessionTypeUnavailable: inputQueryState.sessionTypeState.sessionTypeUnavailable,
      sessionTypeUnavailableMessage: inputQueryState.sessionTypeState.sessionTypeUnavailableMessage,
    });
    presenter.chatInputManager.syncSessionPreferences({
      selectedSessionKey: inputQueryState.selectedSessionKey,
      selectedSessionExists: Boolean(inputQueryState.selectedSession),
      selectedSessionPreferredModel: inputQueryState.selectedSession?.preferredModel,
      selectedSessionPreferredThinking: inputQueryState.selectedSession?.preferredThinking ?? null,
      fallbackPreferredModel: inputQueryState.fallbackPreferredModel,
      fallbackPreferredThinking: inputQueryState.fallbackPreferredThinking,
      defaultModel: inputQueryState.defaultModel,
    });
  }, [
    inputQueryState.defaultModel,
    inputQueryState.defaultProjectRoot,
    inputQueryState.fallbackPreferredModel,
    inputQueryState.fallbackPreferredThinking,
    inputQueryState.isProviderStateResolved,
    inputQueryState.modelOptions,
    inputQueryState.selectedSession,
    inputQueryState.selectedSessionKey,
    inputQueryState.sessionTypeState.canEditSessionType,
    inputQueryState.sessionTypeState.defaultSessionType,
    inputQueryState.sessionTypeState.selectedSessionType,
    inputQueryState.sessionTypeState.sessionTypeOptions,
    inputQueryState.sessionTypeState.sessionTypeUnavailable,
    inputQueryState.sessionTypeState.sessionTypeUnavailableMessage,
    inputQueryState.skillRecords,
    presenter.chatInputManager,
  ]);
  useEffect(() => {
    const request = snapshot.composerFocusRequest;
    if (!request) {
      return;
    }
    if (request.placement === 'end') {
      inputBarRef.current?.focusComposerAtEnd(snapshot.composerNodes);
    }
    presenter.chatInputManager.consumeComposerFocusRequest(request.id);
  }, [presenter.chatInputManager, snapshot.composerFocusRequest, snapshot.composerNodes]);
  const toolbarSelects = buildToolbarSelects({
    allModelsLabel: labels.allModelsLabel,
    favoriteModelLabel: labels.favoriteModelLabel,
    favoriteModelValues,
    favoriteModelsLabel: labels.favoriteModelsLabel,
    hasModelOptions,
    isModelOptionsLoading,
    modelRecords,
    modelSearchEmptyLabel: labels.modelSearchEmptyLabel,
    modelSearchPlaceholder: labels.modelSearchPlaceholder,
    onFavoriteModelToggle: setModelFavorite,
    onModelChange: presenter.chatInputManager.selectModel,
    onThinkingChange: (value) => {
      if (value) {
        presenter.chatInputManager.selectThinkingLevel(value);
      }
    },
    recentModelValues,
    recentModelsLabel: labels.recentModelsLabel,
    selectedModel: snapshot.selectedModel,
    selectedThinkingLevel: snapshot.selectedThinkingLevel as ChatThinkingLevel | null,
    thinkingSupportedLevels,
    thinkingDefaultLevel: selectedModelOption?.thinkingCapability?.default ?? null,
    unfavoriteModelLabel: labels.unfavoriteModelLabel
  });
  const skillPicker = buildSkillPicker({
    allSkillsLabel: labels.allSkillsLabel,
    onSelectedKeysChange: presenter.chatInputManager.selectSkills,
    recentSkillGroupValues,
    recentSkillValues,
    recentSkillsLabel: labels.recentSkillsLabel,
    isSkillsLoading: inputQueryState.isSkillsLoading,
    skillRecords,
    snapshot
  });
  const hasComposerReferenceToken = snapshot.composerNodes.some((node) => node.type === 'token' && node.tokenKind !== 'file');
  const hasSendableDraft =
    snapshot.draft.trim().length > 0 ||
    snapshot.attachments.length > 0 ||
    hasComposerReferenceToken;

  return (
    <>
      <ChatInputBar
        ref={inputBarRef}
        surface={surface}
        composer={{
          nodes: snapshot.composerNodes,
          placeholder: textareaPlaceholder,
          disabled: inputDisabled,
          onNodesChange: presenter.chatInputManager.setComposerNodes,
          ...(attachmentSupported ? { onFilesAdd: handleFilesAdd } : {}),
          inputSurfaceTriggerSpecs: inputSurfaceState.triggerSpecs,
          onInputSurfaceTriggerChange: setInputSurfaceTrigger
        }}
        inputSurface={inputSurfaceState.panel ?? undefined}
        hint={buildModelStateHint({
          isModelOptionsLoading,
          isModelOptionsEmpty,
          onGoToProviders: presenter.chatUiManager.goToProviders,
          texts: {
            noModelOptionsLabel: t('chatModelNoOptions'),
            configureProviderLabel: t('chatGoConfigureProvider')
          }
        })}
        toolbar={{
          selects: toolbarSelects,
          accessories: [
            {
              key: 'attach',
              label: t('chatInputAttach'),
              icon: 'paperclip' as const,
              iconOnly: true,
              disabled: !attachmentSupported || inputDisabled || snapshot.isSending,
              ...(attachmentSupported
                ? {
                    onClick: () => fileInputRef.current?.click()
                  }
                : {
                    tooltip: t('chatInputAttachComingSoon')
                  })
            }
          ],
          skillPicker,
          actions: {
            sendError: isRuntimeBlocked ? null : snapshot.sendError,
            isSending: snapshot.isSending,
            canStopGeneration: snapshot.canStopGeneration,
            sendDisabled: isNcpChatSendDisabled({
              snapshot: availabilitySnapshot,
              hasSendableDraft,
              isRuntimeBlocked
            }),
            stopDisabled: !snapshot.canStopGeneration,
            stopHint: resolvedStopHint,
            sendButtonLabel: t('chatSend'),
            stopButtonLabel: t('chatStop'),
            contextWindow: contextWindowIndicator,
            onSend: presenter.chatInputManager.send,
            onStop: presenter.chatInputManager.stop
          }
        }}
      />
      {attachmentSupported ? (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
      ) : null}
    </>
  );
}
