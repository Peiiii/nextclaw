import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  ChatInputBar,
  type ChatContextWindowIndicator,
  type ChatInputBarHandle,
} from '@nextclaw/agent-chat-ui';
import { isRuntimeDefaultModelValue } from '@nextclaw/shared';

import { useI18n } from '@/app/components/i18n-provider';
import { useViewportLayout } from '@/app/hooks/use-viewport-layout';
import { updateNcpSession, type SessionSkillEntryView, type ThinkingLevel } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import {
  useChatInputSurfaceState,
} from '@/features/chat/features/input/hooks/use-chat-input-surface-state';
import { useChatModelFavorites } from '@/features/chat/features/input/hooks/use-chat-model-favorites';
import {
  deriveChatComposerDraft,
  deriveSelectedSkillsFromComposer,
  pruneComposerAttachments,
  syncComposerSkills,
} from '@/features/chat/features/input/utils/chat-composer-state.utils';
import {
  buildModelStateHint,
  type ChatModelRecord,
  type ChatSkillRecord,
  type ChatThinkingLevel,
} from '@/features/chat/features/input/utils/chat-input-bar.utils';
import {
  hasNcpChatModelOptions,
  isNcpChatComposerDisabled,
  isNcpChatModelOptionsEmpty,
  isNcpChatModelOptionsLoading,
} from '@/features/chat/features/input/utils/ncp-chat-input-availability.utils';
import {
  chatRecentModelsManager,
  CHAT_RECENT_MODELS_MIN_OPTIONS,
} from '@/features/chat/managers/chat-recent-models.manager';
import {
  chatRecentSkillsManager,
  CHAT_RECENT_SKILLS_MIN_OPTIONS,
} from '@/features/chat/managers/chat-recent-skills.manager';

import { useSessionConversationInputAttachments } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-attachments';
import type { useSessionConversationInputQuery } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-query';
import type {
  SessionConversationInputActions,
  SessionConversationInputSnapshot,
} from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';
import {
  buildSessionConversationSkillPicker,
  buildSessionConversationToolbarSelects,
  resolveThinkingForConversationModel,
} from '@/features/chat/features/conversation/utils/session-conversation-input-toolbar.utils';

type SessionConversationInputQuery = ReturnType<typeof useSessionConversationInputQuery>;

export type SessionConversationInputController = {
  readonly canStopGeneration: boolean;
  readonly isSending: boolean;
  readonly sendDisabled: boolean;
  readonly stopDisabled: boolean;
  readonly send: () => Promise<void> | void;
  readonly stop: () => Promise<void> | void;
};

function toSkillRecords(
  snapshotRecords: SessionSkillEntryView[],
  scopeLabels: Record<SessionSkillEntryView['scope'], string>,
): ChatSkillRecord[] {
  return snapshotRecords.map((record) => ({
    key: record.ref,
    label: record.name,
    scopeLabel: scopeLabels[record.scope],
    description: record.description,
    descriptionZh: record.descriptionZh,
    badgeLabel: scopeLabels[record.scope],
  }));
}

function toModelRecords(snapshotModels: SessionConversationInputQuery['modelOptions']): ChatModelRecord[] {
  return snapshotModels.map((model) => ({
    value: model.value,
    modelLabel: model.modelLabel,
    providerLabel: model.providerLabel,
    thinkingCapability: model.thinkingCapability
      ? {
          supported: model.thinkingCapability.supported as ChatThinkingLevel[],
          default: (model.thinkingCapability.default as ChatThinkingLevel | null | undefined) ?? null,
        }
      : null,
  }));
}

function useSessionConversationInputLabels(language: string) {
  const skillScopeLabels = useMemo<Record<'builtin' | 'project' | 'workspace', string>>(() => {
    void language;
    return {
      builtin: t('chatSkillScopeBuiltin'),
      project: t('chatSkillScopeProject'),
      workspace: t('chatSkillScopeWorkspace'),
    };
  }, [language]);
  const slashTexts = useMemo(() => {
    void language;
    return {
      slashSkillSubtitle: t('chatSlashTypeSkill'),
      slashSkillSpecLabel: t('chatSlashSkillSpec'),
      slashSkillScopeLabel: t('chatSlashSkillScope'),
      noSkillDescription: t('chatSkillsPickerNoDescription'),
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
    allSkillsLabel: t('chatPickerAllSkills'),
  };
}

function useSessionConversationInputCollections(params: {
  modelOptions: SessionConversationInputQuery['modelOptions'];
  skillRecords: SessionSkillEntryView[];
  skillScopeLabels: Record<'builtin' | 'project' | 'workspace', string>;
}) {
  const skillRecords = useMemo(
    () => toSkillRecords(params.skillRecords, params.skillScopeLabels),
    [params.skillRecords, params.skillScopeLabels],
  );
  const modelRecords = useMemo(() => toModelRecords(params.modelOptions), [params.modelOptions]);
  return {
    skillRecords,
    modelRecords,
    recentModelValues: chatRecentModelsManager.resolveVisible({
      availableValues: modelRecords.map((option) => option.value),
      minAvailableCount: CHAT_RECENT_MODELS_MIN_OPTIONS,
    }),
    recentSkillValues: chatRecentSkillsManager.resolveVisible({
      availableValues: skillRecords.map((record) => record.key),
      minAvailableCount: 0,
    }),
    recentSkillGroupValues: chatRecentSkillsManager.resolveVisible({
      availableValues: skillRecords.map((record) => record.key),
      minAvailableCount: CHAT_RECENT_SKILLS_MIN_OPTIONS,
    }),
  };
}

type SessionConversationInputProps = {
  readonly contextWindow: ChatContextWindowIndicator | null;
  readonly controller: SessionConversationInputController;
  readonly inputActions: SessionConversationInputActions;
  readonly inputQuery: SessionConversationInputQuery;
  readonly inputSnapshot: SessionConversationInputSnapshot;
  readonly surface?: 'default' | 'embedded';
};

export const SessionConversationInput = memo(function SessionConversationInput(props: SessionConversationInputProps) {
  const {
    contextWindow,
    controller,
    inputActions,
    inputQuery,
    inputSnapshot,
    surface = 'default',
  } = props;
  const presenter = usePresenter();
  const { language } = useI18n();
  const { isMobile } = useViewportLayout();
  const inputBarRef = useRef<ChatInputBarHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const labels = useSessionConversationInputLabels(language);
  const {
    skillRecords,
    modelRecords,
    recentModelValues,
    recentSkillValues,
    recentSkillGroupValues,
  } = useSessionConversationInputCollections({
    modelOptions: inputQuery.modelOptions,
    skillRecords: inputQuery.skillRecords,
    skillScopeLabels: labels.skillScopeLabels,
  });
  const slashCommands = useMemo(() => {
    const parentSessionKey = inputQuery.selectedSessionKey?.trim();
    if (!parentSessionKey) {
      return [];
    }
    return [
      {
        key: 'side-chat',
        title: t('chatSlashCommandSideChatTitle', language),
        description: t('chatSlashCommandSideChatDescription', language),
        detailLines: [t('chatSlashCommandSideChatDetail', language)],
        keywords: ['side', 'chat', 'child', 'branch', 'new'],
        onSelect: () => presenter.chatThreadManager.openSideChatDraft(parentSessionKey),
      },
    ];
  }, [
    inputQuery.selectedSessionKey,
    language,
    presenter.chatThreadManager,
  ]);
  const handleSlashPanelAppSelect = useCallback(
    (appId: string) =>
      void presenter.chatUiManager.showContent({
        target: { type: 'panel_app', payload: { appId } },
      }),
    [presenter.chatUiManager],
  );
  const { inputSurfaceState, setInputSurfaceTrigger } = useChatInputSurfaceState({
    commands: slashCommands,
    isSkillsLoading: inputQuery.isSkillsLoading,
    itemTexts: {
      slashTexts: labels.slashTexts,
    },
    language,
    onSelectPanelApp: handleSlashPanelAppSelect,
    onSelectSkill: chatRecentSkillsManager.remember,
    recentSkillValues,
    skillRecords,
  });
  const modelRecordValues = useMemo(
    () => modelRecords.map((option) => option.value),
    [modelRecords],
  );
  const {
    favoriteModelValues,
    setModelFavorite,
  } = useChatModelFavorites(modelRecordValues);
  const selectedModel =
    inputSnapshot.selectedModel ??
    inputQuery.fallbackPreferredModel ??
    inputQuery.defaultModel ??
    '';
  const selectedThinkingLevel = (
    inputSnapshot.selectedThinkingLevel ??
    inputQuery.fallbackPreferredThinking ??
    null
  ) as ChatThinkingLevel | null;
  const availabilitySnapshot = {
    isProviderStateResolved: inputQuery.isProviderStateResolved,
    modelOptions: inputQuery.modelOptions,
    sessionTypeUnavailable: inputQuery.sessionTypeState.sessionTypeUnavailable,
  };
  const hasModelOptions = hasNcpChatModelOptions(availabilitySnapshot);
  const isModelOptionsLoading = isNcpChatModelOptionsLoading(availabilitySnapshot);
  const isModelOptionsEmpty = isNcpChatModelOptionsEmpty(availabilitySnapshot);
  const inputDisabled = isNcpChatComposerDisabled(availabilitySnapshot);
  const attachmentSupported = true;
  const textareaPlaceholder = isModelOptionsEmpty
    ? t('chatModelNoOptions')
    : t(isMobile ? 'chatInputPlaceholderCompact' : 'chatInputPlaceholder');
  const selectedModelOption = modelRecords.find((option) => option.value === selectedModel);
  const thinkingSupportedLevels = selectedModelOption?.thinkingCapability?.supported ?? [];
  const { handleFilesAdd, handleFileInputChange } = useSessionConversationInputAttachments({
    attachmentSupported,
    inputBarRef,
    addAttachments: inputActions.addAttachments,
  });
  const syncSessionPreferences = useCallback((patch: {
    preferredModel?: string | null;
    preferredThinking?: ThinkingLevel | null;
  }) => {
    if (!inputQuery.selectedSessionKey || !inputQuery.selectedSession) {
      return;
    }
    void updateNcpSession(inputQuery.selectedSessionKey, patch).catch(() => undefined);
  }, [inputQuery.selectedSession, inputQuery.selectedSessionKey]);
  const handleNodesChange = useCallback((nodes: SessionConversationInputSnapshot['nodes']) => {
    const nextNodes = [...nodes];
    const attachments = pruneComposerAttachments(nextNodes, inputSnapshot.attachments);
    inputActions.update({
      nodes: nextNodes,
      attachments,
      text: deriveChatComposerDraft(nextNodes),
      selectedSkills: deriveSelectedSkillsFromComposer(nextNodes),
      sendError: null,
    });
  }, [inputActions, inputSnapshot.attachments]);
  const handleModelChange = useCallback((value: string) => {
    const nextThinkingLevel = resolveThinkingForConversationModel(
      modelRecords.find((option) => option.value === value),
      selectedThinkingLevel,
    );
    inputActions.update({
      selectedModel: value,
      selectedThinkingLevel: nextThinkingLevel,
      sendError: null,
    });
    chatRecentModelsManager.remember(value, {
      namespace: inputQuery.sessionTypeState.selectedSessionType,
    });
    if (!isRuntimeDefaultModelValue(value)) {
      chatRecentModelsManager.remember(value);
    }
    syncSessionPreferences({
      preferredModel: isRuntimeDefaultModelValue(value) ? null : value,
      preferredThinking: nextThinkingLevel,
    });
  }, [
    inputActions,
    inputQuery.sessionTypeState.selectedSessionType,
    modelRecords,
    selectedThinkingLevel,
    syncSessionPreferences,
  ]);
  const handleThinkingChange = useCallback((value: ChatThinkingLevel | null) => {
    inputActions.setSelectedThinkingLevel(value);
    syncSessionPreferences({ preferredThinking: value });
  }, [inputActions, syncSessionPreferences]);
  const handleSelectedSkillsChange = useCallback((next: string[]) => {
    const previousSelection = inputSnapshot.selectedSkills;
    next
      .filter((value) => !previousSelection.includes(value))
      .forEach((value) => chatRecentSkillsManager.remember(value));
    const nextNodes = syncComposerSkills(
      [...inputSnapshot.nodes],
      next,
      inputQuery.skillRecords.map((record) => ({
        ref: record.ref,
        name: record.name,
      })),
    );
    handleNodesChange(nextNodes);
  }, [handleNodesChange, inputQuery.skillRecords, inputSnapshot.nodes, inputSnapshot.selectedSkills]);

  useEffect(() => {
    if (!inputSnapshot.composerFocusRequestId) {
      return;
    }
    inputBarRef.current?.focusComposerAtEnd([...inputSnapshot.nodes]);
    inputActions.consumeComposerFocusRequest();
  }, [
    inputActions,
    inputSnapshot.composerFocusRequestId,
    inputSnapshot.nodes,
  ]);

  const toolbarSelects = buildSessionConversationToolbarSelects({
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
    onModelChange: handleModelChange,
    onThinkingChange: handleThinkingChange,
    recentModelValues,
    recentModelsLabel: labels.recentModelsLabel,
    selectedModel,
    selectedThinkingLevel,
    thinkingSupportedLevels,
    thinkingDefaultLevel: selectedModelOption?.thinkingCapability?.default ?? null,
    unfavoriteModelLabel: labels.unfavoriteModelLabel,
  });
  const skillPicker = buildSessionConversationSkillPicker({
    allSkillsLabel: labels.allSkillsLabel,
    onSelectedKeysChange: handleSelectedSkillsChange,
    recentSkillGroupValues,
    recentSkillValues,
    recentSkillsLabel: labels.recentSkillsLabel,
    isSkillsLoading: inputQuery.isSkillsLoading,
    skillRecords,
    selectedSkills: inputSnapshot.selectedSkills,
  });

  return (
    <>
      <ChatInputBar
        ref={inputBarRef}
        surface={surface}
        composer={{
          nodes: [...inputSnapshot.nodes],
          placeholder: textareaPlaceholder,
          disabled: inputDisabled,
          onNodesChange: handleNodesChange,
          onFilesAdd: handleFilesAdd,
          inputSurfaceTriggerSpecs: inputSurfaceState.triggerSpecs,
          onInputSurfaceTriggerChange: setInputSurfaceTrigger,
        }}
        inputSurface={inputSurfaceState.panel ?? undefined}
        hint={buildModelStateHint({
          isModelOptionsLoading,
          isModelOptionsEmpty,
          onGoToProviders: presenter.chatUiManager.goToProviders,
          texts: {
            noModelOptionsLabel: t('chatModelNoOptions'),
            configureProviderLabel: t('chatGoConfigureProvider'),
          },
        })}
        toolbar={{
          selects: toolbarSelects,
          accessories: [
            {
              key: 'attach',
              label: t('chatInputAttach'),
              icon: 'paperclip' as const,
              iconOnly: true,
              disabled: !attachmentSupported || inputDisabled || controller.isSending,
              onClick: () => fileInputRef.current?.click(),
            },
          ],
          skillPicker,
          actions: {
            sendError: inputSnapshot.sendError,
            isSending: controller.isSending,
            canStopGeneration: controller.canStopGeneration,
            sendDisabled: controller.sendDisabled,
            stopDisabled: controller.stopDisabled,
            stopHint: t('chatStopUnavailable'),
            sendButtonLabel: t('chatSend'),
            stopButtonLabel: t('chatStop'),
            contextWindow,
            onSend: controller.send,
            onStop: controller.stop,
          },
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
    </>
  );
});
