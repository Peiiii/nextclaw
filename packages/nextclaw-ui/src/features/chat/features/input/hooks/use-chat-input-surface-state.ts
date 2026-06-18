import { useMemo, useState } from 'react';
import {
  resolveChatInputSurfaceState,
  type ChatInputSurfaceTrigger,
} from '@nextclaw/agent-chat-ui';
import { usePanelApps } from '@/features/panel-apps';
import { t } from '@/shared/lib/i18n';
import { createPanelAppReferenceInputSurfacePlugin, PANEL_APP_REFERENCE_TRIGGER_SPEC } from '@/features/chat/features/input/input-surface-plugins/panel-app-reference-plugin.utils';
import { createSkillReferenceInputSurfacePlugin } from '@/features/chat/features/input/input-surface-plugins/skill-reference-plugin.utils';
import type { ChatInputBarAdapterTexts, ChatSkillRecord } from '@/features/chat/types/chat-input-bar.types';

export function useChatInputSurfaceState(params: {
  isSkillsLoading: boolean;
  itemTexts: {
    slashTexts: Pick<
      ChatInputBarAdapterTexts,
      'slashSkillSubtitle' | 'slashSkillSpecLabel' | 'slashSkillScopeLabel' | 'noSkillDescription'
    >;
  };
  language: string;
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
  } = params;
  const [inputSurfaceTrigger, setInputSurfaceTrigger] = useState<ChatInputSurfaceTrigger | null>(null);
  const panelApps = usePanelApps({
    enabled: inputSurfaceTrigger?.key === PANEL_APP_REFERENCE_TRIGGER_SPEC.key
  });

  const inputSurfacePlugins = useMemo(
    () => {
      void language;
      return [
        createSkillReferenceInputSurfacePlugin({
          itemTexts: itemTexts.slashTexts,
          menuTexts: {
            loadingLabel: t('chatSlashLoading'),
            sectionLabel: t('chatSlashSectionSkills'),
            emptyLabel: t('chatSlashNoResult'),
            hintLabel: t('chatSlashHint'),
            itemHintLabel: t('chatSlashSkillHint')
          },
          onSelectSkill
        }),
        createPanelAppReferenceInputSurfacePlugin({
          itemTexts: {
            appIdLabel: t('chatPanelAppReferenceAppId'),
            fileLabel: t('chatPanelAppReferenceFile'),
            noDescriptionLabel: t('chatPanelAppReferenceNoDescription'),
            subtitle: t('chatPanelAppReferenceType')
          },
          menuTexts: {
            loadingLabel: t('chatPanelAppReferenceLoading'),
            sectionLabel: t('chatPanelAppReferenceSection'),
            emptyLabel: t('chatPanelAppReferenceNoResult'),
            hintLabel: t('chatPanelAppReferenceHint'),
            itemHintLabel: t('chatPanelAppReferenceItemHint')
          }
        })
      ];
    },
    [
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

  return {
    inputSurfaceState,
    setInputSurfaceTrigger,
  };
}
