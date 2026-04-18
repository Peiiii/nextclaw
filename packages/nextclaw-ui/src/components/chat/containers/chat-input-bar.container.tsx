import { useCallback, useMemo, useRef, useState } from 'react';
import { ChatInputBar, type ChatInputBarHandle } from '@nextclaw/agent-chat-ui';
import {
  DEFAULT_NCP_ATTACHMENT_MAX_BYTES,
  uploadFilesAsNcpDraftAttachments
} from '@nextclaw/ncp-react';
import { uploadNcpAssets } from '@/api/ncp-attachments';
import {
  buildChatSlashItems,
  buildModelStateHint,
  buildModelToolbarSelect,
  buildSkillPickerModel,
  buildThinkingToolbarSelect,
  type ChatModelRecord,
  type ChatSkillRecord,
  type ChatThinkingLevel
} from '@/components/chat/adapters/chat-input-bar.adapter';
import { deriveSelectedSkillsFromComposer } from '@/components/chat/chat-composer-state';
import {
  hasNcpChatModelOptions,
  isNcpChatComposerDisabled,
  isNcpChatModelOptionsEmpty,
  isNcpChatModelOptionsLoading,
  isNcpChatSendDisabled,
} from '@/components/chat/chat-input/ncp-chat-input-availability.utils';
import { usePresenter } from '@/components/chat/presenter/chat-presenter-context';
import {
  CHAT_RECENT_MODELS_MIN_OPTIONS,
  chatRecentModelsManager
} from '@/components/chat/chat-recent-models.manager';
import {
  CHAT_RECENT_SKILLS_MIN_OPTIONS,
  chatRecentSkillsManager
} from '@/components/chat/chat-recent-skills.manager';
import { useI18n } from '@/components/providers/I18nProvider';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import type { SessionSkillEntryView } from '@/api/types';
import { t } from '@/lib/i18n';
import { toast } from 'sonner';

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

export function ChatInputBarContainer() {
  const presenter = usePresenter();
  const { language } = useI18n();
  const snapshot = useChatInputStore((state) => state.snapshot);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const inputBarRef = useRef<ChatInputBarHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const skillScopeLabels = useMemo<Record<'builtin' | 'project' | 'workspace', string>>(() => {
    void language;
    return {
      builtin: t('chatSkillScopeBuiltin'),
      project: t('chatSkillScopeProject'),
      workspace: t('chatSkillScopeWorkspace'),
    };
  }, [language]);
  const slashTexts = useMemo(
    () => {
      void language;
      return {
        slashSkillSubtitle: t('chatSlashTypeSkill'),
        slashSkillSpecLabel: t('chatSlashSkillSpec'),
        slashSkillScopeLabel: t('chatSlashSkillScope'),
        noSkillDescription: t('chatSkillsPickerNoDescription')
      };
    },
    [language]
  );

  const skillRecords = useMemo(
    () => toSkillRecords(snapshot.skillRecords, skillScopeLabels),
    [snapshot.skillRecords, skillScopeLabels]
  );
  const modelRecords = useMemo(() => toModelRecords(snapshot.modelOptions), [snapshot.modelOptions]);
  const recentModelValues = chatRecentModelsManager.resolveVisible({
    availableValues: modelRecords.map((option) => option.value),
    minAvailableCount: CHAT_RECENT_MODELS_MIN_OPTIONS
  });
  const recentSkillValues = chatRecentSkillsManager.resolveVisible({
    availableValues: skillRecords.map((record) => record.key),
    minAvailableCount: 0
  });
  const recentSkillGroupValues = chatRecentSkillsManager.resolveVisible({
    availableValues: skillRecords.map((record) => record.key),
    minAvailableCount: CHAT_RECENT_SKILLS_MIN_OPTIONS
  });

  const hasModelOptions = hasNcpChatModelOptions(snapshot);
  const isModelOptionsLoading = isNcpChatModelOptionsLoading(snapshot);
  const isModelOptionsEmpty = isNcpChatModelOptionsEmpty(snapshot);
  const inputDisabled = isNcpChatComposerDisabled(snapshot);
  const attachmentSupported = typeof presenter.chatInputManager.addAttachments === 'function';
  const textareaPlaceholder = isModelOptionsEmpty
    ? t('chatModelNoOptions')
    : t('chatInputPlaceholder');
  const recentModelsLabel = t('chatPickerRecentModels');
  const allModelsLabel = t('chatPickerAllModels');
  const recentSkillsLabel = t('chatPickerRecent');
  const allSkillsLabel = t('chatPickerAllSkills');

  const slashItems = useMemo(
    () => buildChatSlashItems(skillRecords, slashQuery ?? '', slashTexts, recentSkillValues),
    [slashQuery, skillRecords, slashTexts, recentSkillValues]
  );

  const selectedModelOption = modelRecords.find((option) => option.value === snapshot.selectedModel);
  const selectedModelThinkingCapability = selectedModelOption?.thinkingCapability;
  const thinkingSupportedLevels = selectedModelThinkingCapability?.supported ?? [];

  const resolvedStopHint =
    snapshot.stopDisabledReason === '__preparing__'
      ? t('chatStopPreparing')
      : snapshot.stopDisabledReason?.trim() || t('chatStopUnavailable');

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
    const result = await uploadFilesAsNcpDraftAttachments(files, {
      uploadBatch: uploadNcpAssets,
    });
    if (result.attachments.length > 0) {
      const insertedAttachments = presenter.chatInputManager.addAttachments?.(result.attachments) ?? [];
      if (insertedAttachments.length > 0) {
        inputBarRef.current?.insertFileTokens(
          insertedAttachments.map((attachment) => ({
            tokenKey: attachment.id,
            label: attachment.name
          }))
        );
      }
    }
    if (result.rejected.length > 0) {
      showAttachmentError(result.rejected[0].reason);
    }
  }, [attachmentSupported, presenter.chatInputManager, showAttachmentError]);

  const toolbarSelects = [
    buildModelToolbarSelect({
      modelOptions: modelRecords,
      recentModelValues,
      selectedModel: snapshot.selectedModel,
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
      selectedThinkingLevel: snapshot.selectedThinkingLevel as ChatThinkingLevel | null,
      defaultThinkingLevel: selectedModelThinkingCapability?.default ?? null,
      onValueChange: (value) => presenter.chatInputManager.selectThinkingLevel(value),
      texts: {
        thinkingLabels: buildThinkingLabels()
      }
    })
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const skillPicker = buildSkillPickerModel({
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

  const composerSelectedSkillCount = deriveSelectedSkillsFromComposer(snapshot.composerNodes).length;
  const hasSendableDraft =
    snapshot.draft.trim().length > 0 ||
    snapshot.attachments.length > 0 ||
    composerSelectedSkillCount > 0;

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
          onSelectItem: (item) => {
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
              icon: 'paperclip',
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
            sendError: snapshot.chatRuntimeBlocked ? null : snapshot.sendError,
            isSending: snapshot.isSending,
            canStopGeneration: snapshot.canStopGeneration,
            sendDisabled: isNcpChatSendDisabled({
              snapshot,
              hasSendableDraft,
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
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            event.currentTarget.value = '';
            await handleFilesAdd(files);
          }}
        />
      ) : null}
    </>
  );
}
