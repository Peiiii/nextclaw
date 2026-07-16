import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC,
  resolveChatInputSurfaceState,
  type ChatInputSurfaceTrigger,
} from '@nextclaw/agent-chat-ui';
import { usePanelApps } from '@/features/panel-apps';
import { t, type I18nLanguage } from '@/shared/lib/i18n';
import {
  CONTEXT_REFERENCE_TRIGGER_SPEC,
  createContextReferenceInputSurfacePlugin,
} from '@/features/chat/features/input/input-surface-plugins/context-reference-plugin.utils';
import type { ContextReferenceMode } from '@/features/chat/features/input/input-surface-plugins/chat-input-product-plugin-adapters.types';
import {
  createSlashCommandInputSurfacePlugin,
  type ChatSlashCommandDescriptor,
} from '@/features/chat/features/input/input-surface-plugins/slash-command-plugin.utils';
import type { ChatInputBarAdapterTexts, ChatSkillRecord } from '@/features/chat/types/chat-input-bar.types';
import { useServerPathSearch } from '@/shared/hooks/use-server-path-search';

type ChatInputSurfaceSlashTexts = Pick<
  ChatInputBarAdapterTexts,
  'slashSkillSubtitle' | 'slashSkillSpecLabel' | 'slashSkillScopeLabel' | 'noSkillDescription'
>;

type UseChatInputSurfaceStateParams = {
  commands: readonly ChatSlashCommandDescriptor[];
  isSkillsLoading: boolean;
  itemTexts: { slashTexts: ChatInputSurfaceSlashTexts };
  language: I18nLanguage;
  onSelectPanelApp: (appId: string) => void;
  onSelectSkill: (skillRef: string) => void;
  projectRoot: string;
  recentSkillValues: readonly string[];
  skillRecords: readonly ChatSkillRecord[];
};

function buildChatInputSurfacePlugins(params: {
  commands: readonly ChatSlashCommandDescriptor[];
  language: I18nLanguage;
  onNavigate: (mode: ContextReferenceMode) => void;
  onSelectPanelApp: (appId: string) => void;
  onSelectSkill: (skillRef: string) => void;
  slashTexts: ChatInputSurfaceSlashTexts;
}) {
  const {
    commands,
    language,
    onNavigate,
    onSelectPanelApp,
    onSelectSkill,
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
          directoryDescription: t('chatContextReferenceDirectoryDescription', language),
          fileDescription: t('chatContextReferenceFileDescription', language),
          filesDescription: t('chatContextReferenceFilesDescription', language),
          filesHintLabel: t('chatContextReferenceFilesHint', language),
          filesLabel: t('chatContextReferenceFilesLabel', language),
          filesSubtitle: t('chatContextReferenceFilesType', language),
          panelAppSectionLabel: t('chatPanelAppReferenceSection', language),
          projectRootLabel: t('chatContextReferenceProjectRoot', language),
          searchFailedLabel: t('chatContextReferenceSearchFailed', language),
          workspaceSectionLabel: t('chatContextReferenceWorkspaceSection', language),
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
      onNavigate,
    }),
  ];
}

export function useChatInputSurfaceState(params: UseChatInputSurfaceStateParams) {
  const {
    isSkillsLoading,
    itemTexts,
    language,
    onSelectPanelApp,
    onSelectSkill,
    projectRoot,
    recentSkillValues,
    skillRecords,
    commands,
  } = params;
  const [referenceMode, setReferenceMode] = useState<ContextReferenceMode>('root');
  const [inputSurfaceTrigger, setInputSurfaceTriggerState] = useState<ChatInputSurfaceTrigger | null>(null);
  const inputSurfaceTriggerSignatureRef = useRef('null');
  const setInputSurfaceTrigger = useCallback((nextTrigger: ChatInputSurfaceTrigger | null): void => {
    const nextSignature = JSON.stringify(nextTrigger ? [nextTrigger.key, nextTrigger.marker, nextTrigger.query, nextTrigger.start, nextTrigger.end] : null);
    if (inputSurfaceTriggerSignatureRef.current === nextSignature) return;
    inputSurfaceTriggerSignatureRef.current = nextSignature;
    if (!nextTrigger) {
      setReferenceMode('root');
    }
    setInputSurfaceTriggerState(nextTrigger);
  }, []);
  const isContextReferenceTrigger = inputSurfaceTrigger?.key === CONTEXT_REFERENCE_TRIGGER_SPEC.key;
  const deferredReferenceQuery = useDeferredValue(
    isContextReferenceTrigger ? inputSurfaceTrigger.query : '',
  );
  const shouldSearchServerPaths = Boolean(
    isContextReferenceTrigger &&
    projectRoot &&
    (referenceMode === 'files' || deferredReferenceQuery.trim()),
  );
  const serverPathSearch = useServerPathSearch({
    basePath: projectRoot,
    query: deferredReferenceQuery,
    enabled: shouldSearchServerPaths,
  });
  const shouldLoadPanelApps =
    isContextReferenceTrigger ||
    inputSurfaceTrigger?.key === CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC.key;
  const panelApps = usePanelApps({ enabled: shouldLoadPanelApps });

  const inputSurfacePlugins = useMemo(
    () => buildChatInputSurfacePlugins({
      commands,
      language,
      onNavigate: setReferenceMode,
      onSelectPanelApp,
      onSelectSkill,
      slashTexts: itemTexts.slashTexts,
    }),
    [
      commands,
      itemTexts.slashTexts,
      language,
      onSelectPanelApp,
      onSelectSkill
    ]
  );
  const inputSurfaceState = useMemo(
    () => resolveChatInputSurfaceState({
      data: {
        isPanelAppsLoading: panelApps.isLoading || panelApps.isFetching,
        isServerPathSearchLoading: serverPathSearch.isLoading || serverPathSearch.isFetching,
        isSkillsLoading,
        panelApps: panelApps.data?.entries ?? [],
        projectRoot,
        recentSkillValues,
        referenceMode,
        serverPathEntries: serverPathSearch.data?.entries ?? [],
        serverPathSearchError: serverPathSearch.error instanceof Error
          ? serverPathSearch.error.message
          : null,
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
      projectRoot,
      referenceMode,
      serverPathSearch.data?.entries,
      serverPathSearch.error,
      serverPathSearch.isFetching,
      serverPathSearch.isLoading,
      isSkillsLoading,
      recentSkillValues,
      skillRecords
    ]
  );

  return { inputSurfaceState, setInputSurfaceTrigger };
}
