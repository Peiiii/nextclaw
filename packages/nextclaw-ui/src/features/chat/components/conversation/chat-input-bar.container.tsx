import { useCallback, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { ChatInputBar, type ChatInputBarHandle } from '@nextclaw/agent-chat-ui';
import { DEFAULT_NCP_ATTACHMENT_MAX_BYTES, uploadFilesAsNcpDraftAttachments } from '@nextclaw/ncp-react';
import { uploadNcpAssets } from '@/shared/lib/api';
import type { SessionSkillEntryView } from '@/shared/lib/api';
import { buildChatSlashItems, buildModelStateHint, buildModelToolbarSelect, buildSkillPickerModel, buildThinkingToolbarSelect, type ChatModelRecord, type ChatSkillRecord, type ChatThinkingLevel } from '@/features/chat/utils/chat-input-bar.utils';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { useI18n } from '@/app/components/i18n-provider';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { chatRecentModelsManager, CHAT_RECENT_MODELS_MIN_OPTIONS } from '@/features/chat/managers/chat-recent-models.manager';
import { chatRecentSkillsManager, CHAT_RECENT_SKILLS_MIN_OPTIONS } from '@/features/chat/managers/chat-recent-skills.manager';
import { deriveSelectedSkillsFromComposer } from '@/features/chat/utils/chat-composer-state.utils';
import { hasNcpChatModelOptions, isNcpChatComposerDisabled, isNcpChatModelOptionsEmpty, isNcpChatModelOptionsLoading, isNcpChatSendDisabled } from '@/features/chat/utils/ncp-chat-input-availability.utils';
import { useChatRuntimeAvailability } from '@/features/system-status';
import { t } from '@/shared/lib/i18n';
import { toast } from 'sonner';

type ChatInputStoreSnapshot = ReturnType<typeof useChatInputStore.getState>['snapshot']; type ChatPresenter = ReturnType<typeof usePresenter>;
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
function useChatInputBarCollections(snapshot: ChatInputStoreSnapshot, skillScopeLabels: Record<'builtin' | 'project' | 'workspace', string>) {
  const skillRecords = useMemo(
    () => toSkillRecords(snapshot.skillRecords, skillScopeLabels),
    [snapshot.skillRecords, skillScopeLabels]
  );
  const modelRecords = useMemo(() => toModelRecords(snapshot.modelOptions), [snapshot.modelOptions]);
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
function useChatInputBarAttachments(params: { attachmentSupported: boolean; inputBarRef: RefObject<ChatInputBarHandle | null>; presenter: ChatPresenter; }) {
  const { attachmentSupported, inputBarRef, presenter } = params;
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
function buildToolbarSelects(params: { allModelsLabel: string; hasModelOptions: boolean; isModelOptionsLoading: boolean; modelRecords: ChatModelRecord[]; presenter: ChatPresenter; recentModelValues: string[]; recentModelsLabel: string; selectedModel: string; selectedThinkingLevel: ChatThinkingLevel | null; thinkingSupportedLevels: ChatThinkingLevel[]; thinkingDefaultLevel: ChatThinkingLevel | null; }) {
  const { allModelsLabel, hasModelOptions, isModelOptionsLoading, modelRecords, presenter, recentModelValues, recentModelsLabel, selectedModel, selectedThinkingLevel, thinkingSupportedLevels, thinkingDefaultLevel } = params;
  return [
    buildModelToolbarSelect({
      modelOptions: modelRecords,
      recentModelValues,
      selectedModel,
      isModelOptionsLoading,
      hasModelOptions,
      onValueChange: presenter.chatInputManager.selectModel,
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
      onValueChange: (value) => presenter.chatInputManager.selectThinkingLevel(value),
      texts: {
        thinkingLabels: buildThinkingLabels()
      }
    })
  ].filter((item): item is NonNullable<typeof item> => item !== null);
}
function buildSkillPicker(params: { allSkillsLabel: string; presenter: ChatPresenter; recentSkillGroupValues: string[]; recentSkillValues: string[]; recentSkillsLabel: string; skillRecords: ChatSkillRecord[]; snapshot: ChatInputStoreSnapshot; }) {
  const { allSkillsLabel, presenter, recentSkillGroupValues, recentSkillValues, recentSkillsLabel, skillRecords, snapshot } = params;
  return buildSkillPickerModel({
    skillRecords,
    recentSkillValues,
    groupedRecentSkillValues: recentSkillGroupValues,
    selectedSkills: snapshot.selectedSkills,
    isLoading: snapshot.isSkillsLoading,
    onSelectedKeysChange: presenter.chatInputManager.selectSkills,
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
export function ChatInputBarContainer() {
  const presenter = usePresenter();
  const { language } = useI18n();
  const snapshot = useChatInputStore((state) => state.snapshot);
  const runtimeAvailability = useChatRuntimeAvailability();
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const inputBarRef = useRef<ChatInputBarHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const labels = useChatInputBarLabels(language);
  const { skillRecords, modelRecords, recentModelValues, recentSkillValues, recentSkillGroupValues } = useChatInputBarCollections(snapshot, labels.skillScopeLabels);
  const hasModelOptions = hasNcpChatModelOptions(snapshot);
  const isModelOptionsLoading = isNcpChatModelOptionsLoading(snapshot);
  const isModelOptionsEmpty = isNcpChatModelOptionsEmpty(snapshot);
  const inputDisabled = isNcpChatComposerDisabled(snapshot);
  const attachmentSupported = typeof presenter.chatInputManager.addAttachments === 'function';
  const textareaPlaceholder = isModelOptionsEmpty ? t('chatModelNoOptions') : t('chatInputPlaceholder');
  const slashItems = useMemo(
    () => buildChatSlashItems(skillRecords, slashQuery ?? '', labels.slashTexts, recentSkillValues),
    [labels.slashTexts, recentSkillValues, skillRecords, slashQuery]
  );
  const selectedModelOption = modelRecords.find((option) => option.value === snapshot.selectedModel);
  const thinkingSupportedLevels = selectedModelOption?.thinkingCapability?.supported ?? [];
  const resolvedStopHint = snapshot.stopDisabledReason === '__preparing__'
    ? t('chatStopPreparing')
    : snapshot.stopDisabledReason?.trim() || t('chatStopUnavailable');
  const { handleFilesAdd, handleFileInputChange } = useChatInputBarAttachments({ attachmentSupported, inputBarRef, presenter });
  const toolbarSelects = buildToolbarSelects({
    allModelsLabel: labels.allModelsLabel,
    hasModelOptions,
    isModelOptionsLoading,
    modelRecords,
    presenter,
    recentModelValues,
    recentModelsLabel: labels.recentModelsLabel,
    selectedModel: snapshot.selectedModel,
    selectedThinkingLevel: snapshot.selectedThinkingLevel as ChatThinkingLevel | null,
    thinkingSupportedLevels,
    thinkingDefaultLevel: selectedModelOption?.thinkingCapability?.default ?? null
  });
  const skillPicker = buildSkillPicker({
    allSkillsLabel: labels.allSkillsLabel,
    presenter,
    recentSkillGroupValues,
    recentSkillValues,
    recentSkillsLabel: labels.recentSkillsLabel,
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
          isLoading: snapshot.isSkillsLoading,
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
          onGoToProviders: presenter.chatInputManager.goToProviders,
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
            sendError: runtimeAvailability.isBlocked ? null : snapshot.sendError,
            isSending: snapshot.isSending,
            canStopGeneration: snapshot.canStopGeneration,
            sendDisabled: isNcpChatSendDisabled({
              snapshot,
              hasSendableDraft,
              isRuntimeBlocked: runtimeAvailability.isBlocked
            }),
            stopDisabled: !snapshot.canStopGeneration,
            stopHint: resolvedStopHint,
            sendButtonLabel: t('chatSend'),
            stopButtonLabel: t('chatStop'),
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
