import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC,
  resolveChatInputSurfaceState,
  type ChatInputSurfaceTrigger,
} from '@nextclaw/agent-chat-ui';
import { usePanelApps } from '@/features/panel-apps';
import type { I18nLanguage } from '@/shared/lib/i18n';
import {
  CONTEXT_REFERENCE_TRIGGER_SPEC,
} from '@/features/chat/features/input/input-surface-plugins/context-reference-plugin.utils';
import type { ContextReferenceLocation } from '@/features/chat/features/input/input-surface-plugins/chat-input-product-plugin-adapters.types';
import {
  buildChatInputProductPlugins,
  type ChatInputSurfaceSlashTexts,
} from '@/features/chat/features/input/input-surface-plugins/chat-input-product-plugin-adapters.utils';
import type { ChatSlashCommandDescriptor } from '@/features/chat/features/input/input-surface-plugins/slash-command-plugin.utils';
import type { ChatSkillRecord } from '@/features/chat/types/chat-input-bar.types';
import { useProjects } from '@/shared/hooks/use-projects';
import { useServerPathBrowse } from '@/shared/hooks/use-server-path-browse';
import { useServerPathSearch } from '@/shared/hooks/use-server-path-search';
import { useSystemObjectReferences } from '@/shared/hooks/use-system-object-references';
import type { ServerPathEntryView, ServerPathSearchEntryView } from '@/shared/lib/api';

type UseChatInputSurfaceStateParams = {
  commands: readonly ChatSlashCommandDescriptor[];
  isSkillsLoading: boolean;
  itemTexts: { slashTexts: ChatInputSurfaceSlashTexts };
  language: I18nLanguage;
  onSelectPanelApp: (appId: string) => void;
  onSelectSkill: (skillRef: string) => void;
  onSelectSystemObject: (uri: string) => void;
  projectRoot: string;
  recentSkillValues: readonly string[];
  skillRecords: readonly ChatSkillRecord[];
};

function buildBrowsedReferenceEntries(params: {
  entries: readonly ServerPathEntryView[];
  parentRelativePath: string;
}): ServerPathSearchEntryView[] {
  const parentRelativePath = params.parentRelativePath.split('/').filter(Boolean).join('/');
  return params.entries.map((entry) => ({
    name: entry.name,
    path: entry.path,
    relativePath: [parentRelativePath, entry.name].filter(Boolean).join('/'),
    parentRelativePath,
    kind: entry.kind,
    hidden: entry.hidden,
  }));
}

function useContextReferenceCatalogQueries(params: {
  inputSurfaceTrigger: ChatInputSurfaceTrigger | null;
  isContextReferenceTrigger: boolean;
  query: string;
  referenceLocation: ContextReferenceLocation;
}) {
  const {
    inputSurfaceTrigger,
    isContextReferenceTrigger,
    query,
    referenceLocation,
  } = params;
  const shouldLoadPanelApps =
    (isContextReferenceTrigger && referenceLocation.view === 'root') ||
    inputSurfaceTrigger?.key === CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC.key;
  const panelApps = usePanelApps({ enabled: shouldLoadPanelApps });
  const projects = useProjects({
    enabled: Boolean(
      isContextReferenceTrigger &&
      (referenceLocation.view === 'root' || referenceLocation.view === 'projects'),
    ),
  });
  const objectType = referenceLocation.view === 'system-objects'
    ? referenceLocation.objectType
    : undefined;
  const systemObjects = useSystemObjectReferences({
    enabled: Boolean(
      isContextReferenceTrigger &&
      (referenceLocation.view === 'root' || referenceLocation.view === 'system-objects'),
    ),
    query,
    limit: objectType ? 20 : 6,
    objectType,
  });
  return { panelApps, projects, systemObjects };
}

export function useChatInputSurfaceState(params: UseChatInputSurfaceStateParams) {
  const {
    isSkillsLoading,
    itemTexts,
    language,
    onSelectPanelApp,
    onSelectSkill,
    onSelectSystemObject,
    projectRoot,
    recentSkillValues,
    skillRecords,
    commands,
  } = params;
  const [referenceLocation, setReferenceLocation] = useState<ContextReferenceLocation>({
    view: 'root',
  });
  const [inputSurfaceTrigger, setInputSurfaceTriggerState] = useState<ChatInputSurfaceTrigger | null>(null);
  const inputSurfaceTriggerSignatureRef = useRef('null');
  const setInputSurfaceTrigger = useCallback((nextTrigger: ChatInputSurfaceTrigger | null): void => {
    const nextSignature = JSON.stringify(nextTrigger ? [nextTrigger.key, nextTrigger.marker, nextTrigger.query, nextTrigger.start, nextTrigger.end] : null);
    if (inputSurfaceTriggerSignatureRef.current === nextSignature) return;
    inputSurfaceTriggerSignatureRef.current = nextSignature;
    if (!nextTrigger) {
      setReferenceLocation({ view: 'root' });
    }
    setInputSurfaceTriggerState(nextTrigger);
  }, []);
  const isContextReferenceTrigger = inputSurfaceTrigger?.key === CONTEXT_REFERENCE_TRIGGER_SPEC.key;
  const isWorkspaceReferenceView =
    referenceLocation.view === 'files' || referenceLocation.view === 'folders';
  const referencePath = isWorkspaceReferenceView ? referenceLocation.path : '';
  const deferredReferenceQuery = useDeferredValue(
    isContextReferenceTrigger ? inputSurfaceTrigger.query : '',
  );
  const isBrowsingServerPaths = Boolean(
    isContextReferenceTrigger &&
    projectRoot &&
    isWorkspaceReferenceView &&
    !deferredReferenceQuery.trim(),
  );
  const shouldSearchServerPaths = Boolean(
    isContextReferenceTrigger &&
    projectRoot &&
    (referenceLocation.view === 'root' || isWorkspaceReferenceView) &&
    deferredReferenceQuery.trim(),
  );
  const serverPathBrowse = useServerPathBrowse({
    path: referencePath || '.',
    basePath: projectRoot,
    includeFiles: referenceLocation.view === 'files',
    enabled: isBrowsingServerPaths,
  });
  const serverPathSearch = useServerPathSearch({
    basePath: projectRoot,
    query: deferredReferenceQuery,
    enabled: shouldSearchServerPaths,
  });
  const activeServerPathQuery = isBrowsingServerPaths ? serverPathBrowse : serverPathSearch;
  const serverPathEntries = useMemo(
    () => isBrowsingServerPaths
      ? buildBrowsedReferenceEntries({
          entries: serverPathBrowse.data?.entries ?? [],
          parentRelativePath: referencePath,
        })
      : serverPathSearch.data?.entries ?? [],
    [
      isBrowsingServerPaths,
      referencePath,
      serverPathBrowse.data?.entries,
      serverPathSearch.data?.entries,
    ],
  );
  const { panelApps, projects, systemObjects } = useContextReferenceCatalogQueries({
    inputSurfaceTrigger,
    isContextReferenceTrigger,
    query: deferredReferenceQuery,
    referenceLocation,
  });

  const inputSurfacePlugins = useMemo(
    () => buildChatInputProductPlugins({
      commands,
      language,
      onNavigate: setReferenceLocation,
      onSelectPanelApp,
      onSelectSkill,
      onSelectSystemObject,
      slashTexts: itemTexts.slashTexts,
    }),
    [
      commands,
      itemTexts.slashTexts,
      language,
      onSelectPanelApp,
      onSelectSkill,
      onSelectSystemObject,
    ]
  );
  const inputSurfaceState = useMemo(
    () => resolveChatInputSurfaceState({
      data: {
        isPanelAppsLoading: panelApps.isLoading || panelApps.isFetching,
        isProjectsLoading: projects.isLoading || projects.isFetching,
        isServerPathSearchLoading: activeServerPathQuery.isLoading || activeServerPathQuery.isFetching,
        isSkillsLoading,
        isSystemObjectsLoading: systemObjects.isLoading || systemObjects.isFetching,
        panelApps: panelApps.data?.entries ?? [],
        projectRoot,
        projects: projects.data?.projects ?? [],
        projectsError: projects.error instanceof Error ? projects.error.message : null,
        recentSkillValues,
        referenceLocation,
        serverPathEntries,
        serverPathSearchError: activeServerPathQuery.error instanceof Error
          ? activeServerPathQuery.error.message
          : null,
        skillRecords,
        systemObjectGroups: systemObjects.data?.groups ?? [],
        systemObjectsError: systemObjects.error instanceof Error ? systemObjects.error.message : null,
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
      projects.data?.projects,
      projects.error,
      projects.isFetching,
      projects.isLoading,
      activeServerPathQuery.error,
      activeServerPathQuery.isFetching,
      activeServerPathQuery.isLoading,
      referenceLocation,
      serverPathEntries,
      isSkillsLoading,
      recentSkillValues,
      skillRecords,
      systemObjects.data?.groups,
      systemObjects.error,
      systemObjects.isFetching,
      systemObjects.isLoading,
    ]
  );

  return { inputSurfaceState, setInputSurfaceTrigger };
}
