import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { ChatInputBar, type ChatInputBarHandle } from '@nextclaw/agent-chat-ui';
import { DEFAULT_NCP_ATTACHMENT_MAX_BYTES, uploadFilesAsNcpDraftAttachments } from '@nextclaw/ncp-react';
import { uploadNcpAssets } from '@/shared/lib/api';
import type { SessionSkillEntryView } from '@/shared/lib/api';
import { buildChatSlashItems, buildModelStateHint, buildModelToolbarSelect, buildSkillPickerModel, buildThinkingToolbarSelect, type ChatModelRecord, type ChatSkillRecord, type ChatThinkingLevel } from '@/features/chat/features/input/utils/chat-input-bar.utils';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { useI18n } from '@/app/components/i18n-provider';
import { useViewportLayout } from '@/app/hooks/use-viewport-layout';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import {
  useNcpChatProviderStateResolved,
  useNcpChatSelectedSession,
} from '@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state';
import { useNcpChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import {
  buildNcpChatProviderModelOptions,
  filterNcpChatModelOptionsBySessionType,
} from '@/features/chat/features/ncp/utils/ncp-chat-query-derived.utils';
import { useChatSessionTypeState } from '@/features/chat/features/session-type/hooks/use-chat-session-type-state';
import { chatRecentModelsManager, CHAT_RECENT_MODELS_MIN_OPTIONS } from '@/features/chat/managers/chat-recent-models.manager';
import { chatRecentSkillsManager, CHAT_RECENT_SKILLS_MIN_OPTIONS } from '@/features/chat/managers/chat-recent-skills.manager';
import { deriveSelectedSkillsFromComposer } from '@/features/chat/features/input/utils/chat-composer-state.utils';
import { hasNcpChatModelOptions, isNcpChatComposerDisabled, isNcpChatModelOptionsEmpty, isNcpChatModelOptionsLoading, isNcpChatSendDisabled } from '@/features/chat/features/input/utils/ncp-chat-input-availability.utils';
import { useSelectedSessionContextWindowIndicator } from '@/features/chat/features/session/hooks/use-selected-session-context-window-indicator';
import { useSystemStatus } from '@/features/system-status';
import { isNcpChatRuntimeBlocked } from '@/features/chat/features/runtime/utils/ncp-chat-runtime-availability.utils';
import { t } from '@/shared/lib/i18n';
import { toast } from 'sonner';

type ChatInputStoreSnapshot = ReturnType<typeof useChatInputStore.getState>['snapshot'];
const EMPTY_SESSION_SKILL_RECORDS: SessionSkillEntryView[] = [];

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
function buildToolbarSelects(params: { allModelsLabel: string; hasModelOptions: boolean; isModelOptionsLoading: boolean; modelRecords: ChatModelRecord[]; onModelChange: (value: string) => void; onThinkingChange: (value: ChatThinkingLevel | null) => void; recentModelValues: string[]; recentModelsLabel: string; selectedModel: string; selectedThinkingLevel: ChatThinkingLevel | null; thinkingSupportedLevels: ChatThinkingLevel[]; thinkingDefaultLevel: ChatThinkingLevel | null; }) {
  const { allModelsLabel, hasModelOptions, isModelOptionsLoading, modelRecords, onModelChange, onThinkingChange, recentModelValues, recentModelsLabel, selectedModel, selectedThinkingLevel, thinkingSupportedLevels, thinkingDefaultLevel } = params;
  return [
    buildModelToolbarSelect({
      modelOptions: modelRecords,
      recentModelValues,
      selectedModel,
      isModelOptionsLoading,
      hasModelOptions,
      onValueChange: onModelChange,
      texts: {
        modelSelectPlaceholder: t('chatSelectModel'),
        modelNoOptionsLabel: t('chatModelNoOptions'),
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

function useChatInputBarQueryState(snapshot: ChatInputStoreSnapshot) {
  const presenter = usePresenter();
  const selectedSessionKey = useChatSessionListStore(
    (state) => state.snapshot.selectedSessionKey,
  );
  const selectedSession = useNcpChatSelectedSession(selectedSessionKey);
  const isProviderStateResolved = useNcpChatProviderStateResolved();
  const config = useNcpChatQueryStore(
    (state) => state.snapshot.configQuery?.data ?? null,
  );
  const providersView = useNcpChatQueryStore(
    (state) => state.snapshot.providersQuery?.data ?? null,
  );
  const templatesView = useNcpChatQueryStore(
    (state) => state.snapshot.providerTemplatesQuery?.data ?? null,
  );
  const sessionTypesData = useNcpChatQueryStore(
    (state) => state.snapshot.sessionTypesQuery?.data ?? null,
  );
  const skillRecords = useNcpChatQueryStore(
    (state) =>
      state.snapshot.sessionSkillsQuery?.data?.records ?? EMPTY_SESSION_SKILL_RECORDS,
  );
  const isSkillsLoading = useNcpChatQueryStore(
    (state) =>
      Boolean(
        state.snapshot.sessionSkillsQuery?.isLoading ||
          state.snapshot.sessionSkillsQuery?.isFetching,
      ),
  );
  const sessionTypeState = useChatSessionTypeState({
    selectedSession,
    pendingSessionType: snapshot.pendingSessionType,
    setPendingSessionType: presenter.chatInputManager.setPendingSessionType,
    sessionTypesData,
  });
  const providerModelOptions = useMemo(
    () =>
      buildNcpChatProviderModelOptions({
        config,
        providersView,
        templatesView,
      }),
    [config, providersView, templatesView],
  );
  const modelOptions = useMemo(
    () =>
      filterNcpChatModelOptionsBySessionType({
        modelOptions: providerModelOptions,
        supportedModels: sessionTypeState.selectedSessionTypeOption?.supportedModels,
      }),
    [providerModelOptions, sessionTypeState.selectedSessionTypeOption?.supportedModels],
  );

  return {
    isProviderStateResolved,
    isSkillsLoading,
    modelOptions,
    skillRecords,
  };
}

export function ChatInputBarContainer() {
  const presenter = usePresenter();
  const { language } = useI18n();
  const { isMobile } = useViewportLayout();
  const snapshot = useChatInputStore((state) => state.snapshot);
  const inputQueryState = useChatInputBarQueryState(snapshot);
  const isRuntimeBlocked = isNcpChatRuntimeBlocked(useSystemStatus());
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const inputBarRef = useRef<ChatInputBarHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const labels = useChatInputBarLabels(language);
  const { skillRecords, modelRecords, recentModelValues, recentSkillValues, recentSkillGroupValues } = useChatInputBarCollections({
    modelOptions: inputQueryState.modelOptions,
    skillRecords: inputQueryState.skillRecords,
    skillScopeLabels: labels.skillScopeLabels
  });
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
  const slashItems = useMemo(
    () => buildChatSlashItems(skillRecords, slashQuery ?? '', labels.slashTexts, recentSkillValues),
    [labels.slashTexts, recentSkillValues, skillRecords, slashQuery]
  );
  const contextWindowIndicator = useSelectedSessionContextWindowIndicator();
  const selectedModelOption = modelRecords.find((option) => option.value === snapshot.selectedModel);
  const thinkingSupportedLevels = selectedModelOption?.thinkingCapability?.supported ?? [];
  const resolvedStopHint = snapshot.stopDisabledReason === '__preparing__'
    ? t('chatStopPreparing')
    : snapshot.stopDisabledReason?.trim() || t('chatStopUnavailable');
  const { handleFilesAdd, handleFileInputChange } = useChatInputBarAttachments({ attachmentSupported, inputBarRef });
  useEffect(() => {
    const request = snapshot.composerFocusRequest;
    if (!request) {
      return;
    }
    if (request.placement === 'end') {
      inputBarRef.current?.focusComposerAtEnd();
    }
    presenter.chatInputManager.consumeComposerFocusRequest(request.id);
  }, [presenter.chatInputManager, snapshot.composerFocusRequest]);
  const toolbarSelects = buildToolbarSelects({
    allModelsLabel: labels.allModelsLabel,
    hasModelOptions,
    isModelOptionsLoading,
    modelRecords,
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
    thinkingDefaultLevel: selectedModelOption?.thinkingCapability?.default ?? null
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
  const hasSendableDraft = snapshot.draft.trim().length > 0 || snapshot.attachments.length > 0 || deriveSelectedSkillsFromComposer(snapshot.composerNodes).length > 0;

  return (
    <>
      <ChatInputBar
        ref={inputBarRef}
        composer={{
          nodes: snapshot.composerNodes,
          placeholder: textareaPlaceholder,
          disabled: inputDisabled,
          onNodesChange: presenter.chatInputManager.setComposerNodes,
          ...(attachmentSupported ? { onFilesAdd: handleFilesAdd } : {}),
          onSlashQueryChange: setSlashQuery
        }}
        slashMenu={{
          isLoading: inputQueryState.isSkillsLoading,
          items: slashItems,
          onSelectItem: (item: { value?: string }) => {
            if (item.value) {
              presenter.chatInputManager.rememberSkillSelection(item.value);
            }
          },
          texts: {
            slashLoadingLabel: t('chatSlashLoading'),
            slashSectionLabel: t('chatSlashSectionSkills'),
            slashEmptyLabel: t('chatSlashNoResult'),
            slashHintLabel: t('chatSlashHint'),
            slashSkillHintLabel: t('chatSlashSkillHint')
          }
        }}
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
