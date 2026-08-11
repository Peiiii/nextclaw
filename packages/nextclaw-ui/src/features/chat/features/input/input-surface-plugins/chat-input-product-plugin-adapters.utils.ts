import type { ChatInputSurfacePlugin } from '@nextclaw/agent-chat-ui';
import { t, type I18nLanguage } from '@/shared/lib/i18n';
import type { ChatInputBarAdapterTexts } from '@/features/chat/types/chat-input-bar.types';
import {
  createContextReferenceInputSurfacePlugin,
} from './context-reference-plugin.utils';
import {
  createSlashCommandInputSurfacePlugin,
  type ChatSlashCommandDescriptor,
} from './slash-command-plugin.utils';
import type {
  ChatInputProductPluginData,
  ContextReferenceLocation,
} from './chat-input-product-plugin-adapters.types';

export type ChatInputSurfaceSlashTexts = Pick<
  ChatInputBarAdapterTexts,
  'slashSkillSubtitle' | 'slashSkillSpecLabel' | 'slashSkillScopeLabel' | 'noSkillDescription'
>;

export function buildChatInputProductPlugins(params: {
  commands: readonly ChatSlashCommandDescriptor[];
  language: I18nLanguage;
  onNavigate: (location: ContextReferenceLocation) => void;
  onSelectPanelApp: (appId: string) => void;
  onSelectSkill: (skillRef: string) => void;
  onSelectSystemObject: (uri: string) => void;
  slashTexts: ChatInputSurfaceSlashTexts;
}): ChatInputSurfacePlugin<ChatInputProductPluginData>[] {
  const {
    commands,
    language,
    onNavigate,
    onSelectPanelApp,
    onSelectSkill,
    onSelectSystemObject,
    slashTexts,
  } = params;
  const panelAppTexts = {
    appIdLabel: t('chatPanelAppReferenceAppId', language),
    fileLabel: t('chatPanelAppReferenceFile', language),
    noDescriptionLabel: t('chatPanelAppReferenceNoDescription', language),
    subtitle: t('chatPanelAppReferenceType', language),
  };
  return [
    createSlashCommandInputSurfacePlugin({
      commands,
      itemTexts: {
        panelAppTexts,
        skillTexts: slashTexts,
      },
      menuTexts: {
        loadingLabel: t('chatSlashLoading', language),
        sectionLabel: t('chatSlashSection', language),
        emptyLabel: t('chatSlashNoResult', language),
        hintLabel: t('chatSlashHint', language),
        itemHintLabel: t('chatSlashSkillHint', language),
      },
      labels: {
        commandHintLabel: t('chatSlashCommandHint', language),
        commandSectionLabel: t('chatSlashSectionCommands', language),
        commandSubtitle: t('chatSlashTypeCommand', language),
        filterAllLabel: t('chatSlashFilterAll', language),
        filterCommandsLabel: t('chatSlashFilterCommands', language),
        filterPanelAppsLabel: t('chatSlashFilterPanelApps', language),
        filterSkillsLabel: t('chatSlashFilterSkills', language),
        panelAppHintLabel: t('chatSlashPanelAppHint', language),
        panelAppSectionLabel: t('chatPanelAppReferenceSection', language),
        skillHintLabel: t('chatSlashSkillHint', language),
        skillSectionLabel: t('chatSlashSectionSkills', language),
      },
      onSelectPanelApp,
      onSelectSkill,
    }),
    createContextReferenceInputSurfacePlugin({
      itemTexts: {
        context: {
          backLabel: t('chatContextReferenceBack', language),
          backDescription: t('chatContextReferenceBackDescription', language),
          backHintLabel: t('chatContextReferenceBackHint', language),
          currentDirectoryLabel: t('chatContextReferenceCurrentDirectory', language),
          directoryDescription: t('chatContextReferenceDirectoryDescription', language),
          fileDescription: t('chatContextReferenceFileDescription', language),
          filesDescription: t('chatContextReferenceFilesDescription', language),
          filesHintLabel: t('chatContextReferenceFilesHint', language),
          filesLabel: t('chatContextReferenceFilesLabel', language),
          filesSubtitle: t('chatContextReferenceFilesType', language),
          foldersDescription: t('chatContextReferenceFoldersDescription', language),
          foldersHintLabel: t('chatContextReferenceFoldersHint', language),
          foldersLabel: t('chatContextReferenceFoldersLabel', language),
          foldersSubtitle: t('chatContextReferenceFoldersType', language),
          panelAppSectionLabel: t('chatPanelAppReferenceSection', language),
          parentLabel: t('chatContextReferenceParent', language),
          parentDescription: t('chatContextReferenceParentDescription', language),
          parentHintLabel: t('chatContextReferenceParentHint', language),
          projectDescription: t('chatContextReferenceProjectDescription', language),
          projectPathLabel: t('chatContextReferenceProjectPath', language),
          projectSectionLabel: t('chatContextReferenceProjectSection', language),
          projectSubtitle: t('chatContextReferenceProjectType', language),
          projectsDescription: t('chatContextReferenceProjectsDescription', language),
          projectsHintLabel: t('chatContextReferenceProjectsHint', language),
          projectsLabel: t('chatContextReferenceProjectsLabel', language),
          projectsLoadFailedLabel: t('chatContextReferenceProjectsLoadFailed', language),
          projectsSubtitle: t('chatContextReferenceProjectsType', language),
          projectRootLabel: t('chatContextReferenceProjectRoot', language),
          searchFailedLabel: t('chatContextReferenceSearchFailed', language),
          systemObjectGroupHintLabel: t('chatSystemObjectGroupHint', language),
          systemObjectSectionLabel: t('chatSystemObjectSection', language),
        },
        panelApp: panelAppTexts,
      },
      menuTexts: {
        loadingLabel: t('chatContextReferenceLoading', language),
        sectionLabel: t('chatContextReferenceSection', language),
        emptyLabel: t('chatContextReferenceNoResult', language),
        hintLabel: t('chatContextReferenceHint', language),
        itemHintLabel: t('chatContextReferenceItemHint', language),
      },
      language,
      onNavigate,
      onSelectSystemObject,
    }),
  ];
}
