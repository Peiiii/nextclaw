import { useCallback, useMemo, useRef, useState } from 'react';
import {
  resolveChatInputSurfaceState,
  type ChatInputSurfaceTrigger,
} from '@nextclaw/agent-chat-ui';
import { usePanelApps } from '@/features/panel-apps';
import { t, type I18nLanguage } from '@/shared/lib/i18n';
import { createPanelAppReferenceInputSurfacePlugin, PANEL_APP_REFERENCE_TRIGGER_SPEC } from '@/features/chat/features/input/input-surface-plugins/panel-app-reference-plugin.utils';
import {
  createSlashCommandInputSurfacePlugin,
  type ChatSlashCommandDescriptor,
} from '@/features/chat/features/input/input-surface-plugins/slash-command-plugin.utils';
import type { ChatInputBarAdapterTexts, ChatSkillRecord } from '@/features/chat/types/chat-input-bar.types';

export function useChatInputSurfaceState(params: {
  commands: readonly ChatSlashCommandDescriptor[];
  isSkillsLoading: boolean;
  itemTexts: {
    slashTexts: Pick<
      ChatInputBarAdapterTexts,
      'slashSkillSubtitle' | 'slashSkillSpecLabel' | 'slashSkillScopeLabel' | 'noSkillDescription'
    >;
  };
  language: I18nLanguage;
  onSelectSkill: (skillRef: string) => void;
  recentSkillValues: readonly string[];
  skillRecords: readonly ChatSkillRecord[];
}) {
  const {
    isSkillsLoading,
    itemTexts,
    language,
    onSelectSkill,
    recentSkillValues,
    skillRecords,
    commands,
  } = params;
  const [inputSurfaceTrigger, setInputSurfaceTriggerState] = useState<ChatInputSurfaceTrigger | null>(null);
  const inputSurfaceTriggerSignatureRef = useRef('null');
  const setInputSurfaceTrigger = useCallback((nextTrigger: ChatInputSurfaceTrigger | null): void => {
    const nextSignature = JSON.stringify(nextTrigger ? [nextTrigger.key, nextTrigger.marker, nextTrigger.query, nextTrigger.start, nextTrigger.end] : null);
    if (inputSurfaceTriggerSignatureRef.current === nextSignature) return;
    inputSurfaceTriggerSignatureRef.current = nextSignature;
    setInputSurfaceTriggerState(nextTrigger);
  }, []);
  const panelApps = usePanelApps({ enabled: inputSurfaceTrigger?.key === PANEL_APP_REFERENCE_TRIGGER_SPEC.key });

  const inputSurfacePlugins = useMemo(
    () => [
      createSlashCommandInputSurfacePlugin({
        commands,
        itemTexts: itemTexts.slashTexts,
        menuTexts: {
          loadingLabel: t('chatSlashLoading', language),
          sectionLabel: t('chatSlashSection', language),
          emptyLabel: t('chatSlashNoResult', language),
          hintLabel: t('chatSlashHint', language),
          itemHintLabel: t('chatSlashSkillHint', language)
        },
        labels: {
          commandHintLabel: t('chatSlashCommandHint', language),
          commandSectionLabel: t('chatSlashSectionCommands', language),
          commandSubtitle: t('chatSlashTypeCommand', language),
          skillHintLabel: t('chatSlashSkillHint', language),
          skillSectionLabel: t('chatSlashSectionSkills', language)
        },
        onSelectSkill
      }),
      createPanelAppReferenceInputSurfacePlugin({
        itemTexts: {
          appIdLabel: t('chatPanelAppReferenceAppId', language),
          fileLabel: t('chatPanelAppReferenceFile', language),
          noDescriptionLabel: t('chatPanelAppReferenceNoDescription', language),
          subtitle: t('chatPanelAppReferenceType', language)
        },
        menuTexts: {
          loadingLabel: t('chatPanelAppReferenceLoading', language),
          sectionLabel: t('chatPanelAppReferenceSection', language),
          emptyLabel: t('chatPanelAppReferenceNoResult', language),
          hintLabel: t('chatPanelAppReferenceHint', language),
          itemHintLabel: t('chatPanelAppReferenceItemHint', language)
        }
      })
    ],
    [
      commands,
      itemTexts.slashTexts,
      language,
      onSelectSkill
    ]
  );
  const inputSurfaceState = useMemo(
    () => resolveChatInputSurfaceState({
      data: {
        isPanelAppsLoading: panelApps.isLoading || panelApps.isFetching,
        isSkillsLoading,
        panelApps: panelApps.data?.entries ?? [],
        recentSkillValues,
        skillRecords
      },
      plugins: inputSurfacePlugins,
      trigger: inputSurfaceTrigger
    }),
    [
      inputSurfacePlugins,
      inputSurfaceTrigger,
      panelApps.data?.entries,
      panelApps.isFetching,
      panelApps.isLoading,
      isSkillsLoading,
      recentSkillValues,
      skillRecords
    ]
  );

  return { inputSurfaceState, setInputSurfaceTrigger };
}
