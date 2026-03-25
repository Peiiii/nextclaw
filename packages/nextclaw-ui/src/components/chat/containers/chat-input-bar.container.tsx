import { useCallback, useMemo, useRef, useState } from 'react';
import { ChatInputBar, type ChatInputBarHandle } from '@nextclaw/agent-chat-ui';
import {
  DEFAULT_NCP_IMAGE_ATTACHMENT_ACCEPT,
  DEFAULT_NCP_IMAGE_ATTACHMENT_MAX_BYTES,
  readFilesAsNcpDraftAttachments
} from '@nextclaw/ncp-react';
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
import { usePresenter } from '@/components/chat/presenter/chat-presenter-context';
import { useI18n } from '@/components/providers/I18nProvider';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
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

function toSkillRecords(snapshotRecords: Array<{
  spec: string;
  label?: string;
  description?: string;
  descriptionZh?: string;
  origin?: string;
}>, officialBadgeLabel: string): ChatSkillRecord[] {
  return snapshotRecords.map((record) => ({
    key: record.spec,
    label: record.label || record.spec,
    description: record.description,
    descriptionZh: record.descriptionZh,
    badgeLabel: record.origin === 'builtin' ? officialBadgeLabel : undefined
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

  const officialSkillBadgeLabel = useMemo(() => {
    // Keep memo reactive to locale switches even though `t` is imported as a stable function.
    const locale = language;
    void locale;
    return t('chatSkillsPickerOfficial');
  }, [language]);
  const slashTexts = useMemo(
    () => {
      // Keep memo reactive to locale switches even though `t` is imported as a stable function.
      const locale = language;
      void locale;
      return {
        slashSkillSubtitle: t('chatSlashTypeSkill'),
        slashSkillSpecLabel: t('chatSlashSkillSpec'),
        noSkillDescription: t('chatSkillsPickerNoDescription')
      };
    },
    [language]
  );

  const skillRecords = useMemo(
    () => toSkillRecords(snapshot.skillRecords, officialSkillBadgeLabel),
    [snapshot.skillRecords, officialSkillBadgeLabel]
  );
  const modelRecords = useMemo(() => toModelRecords(snapshot.modelOptions), [snapshot.modelOptions]);

  const hasModelOptions = modelRecords.length > 0;
  const isModelOptionsLoading = !snapshot.isProviderStateResolved && !hasModelOptions;
  const isModelOptionsEmpty = snapshot.isProviderStateResolved && !hasModelOptions;
  const inputDisabled =
    ((isModelOptionsLoading || isModelOptionsEmpty) && !snapshot.isSending) || snapshot.sessionTypeUnavailable;
  const attachmentSupported = typeof presenter.chatInputManager.addAttachments === 'function';
  const textareaPlaceholder = isModelOptionsLoading
    ? ''
    : hasModelOptions
      ? t('chatInputPlaceholder')
      : t('chatModelNoOptions');

  const slashItems = useMemo(
    () => buildChatSlashItems(skillRecords, slashQuery ?? '', slashTexts),
    [slashQuery, skillRecords, slashTexts]
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
      toast.error(t('chatInputImageUnsupported'));
      return;
    }
    if (reason === 'too-large') {
      toast.error(
        t('chatInputImageTooLarge').replace('{maxMb}', String(DEFAULT_NCP_IMAGE_ATTACHMENT_MAX_BYTES / (1024 * 1024)))
      );
      return;
    }
    toast.error(t('chatInputImageReadFailed'));
  }, []);

  const handleFilesAdd = useCallback(async (files: File[]) => {
    if (!attachmentSupported || files.length === 0) {
      return;
    }
    const result = await readFilesAsNcpDraftAttachments(files);
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
      selectedModel: snapshot.selectedModel,
      isModelOptionsLoading,
      hasModelOptions,
      onValueChange: presenter.chatInputManager.selectModel,
      texts: {
        modelSelectPlaceholder: t('chatSelectModel'),
        modelNoOptionsLabel: t('chatModelNoOptions')
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
    selectedSkills: snapshot.selectedSkills,
    isLoading: snapshot.isSkillsLoading,
    onSelectedKeysChange: presenter.chatInputManager.selectSkills,
    texts: {
      title: t('chatSkillsPickerTitle'),
      searchPlaceholder: t('chatSkillsPickerSearchPlaceholder'),
      emptyLabel: t('chatSkillsPickerEmpty'),
      loadingLabel: t('sessionsLoading'),
      manageLabel: t('chatSkillsPickerManage')
    }
  });

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
            sendError: snapshot.sendError,
            isSending: snapshot.isSending,
            canStopGeneration: snapshot.canStopGeneration,
            sendDisabled:
              (snapshot.draft.trim().length === 0 && snapshot.attachments.length === 0) ||
              !hasModelOptions ||
              snapshot.sessionTypeUnavailable,
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
          accept={DEFAULT_NCP_IMAGE_ATTACHMENT_ACCEPT}
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
