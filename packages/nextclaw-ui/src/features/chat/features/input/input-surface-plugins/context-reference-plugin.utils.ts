import {
  createInputSurfaceTriggeredPanelPlugin,
  type ChatInputSurfaceItem,
  type ChatInputSurfaceMenuTexts,
  type ChatInputSurfacePlugin,
  type ChatInputSurfaceTriggerSpec,
} from '@nextclaw/agent-chat-ui';
import type { ServerPathSearchEntryView } from '@/shared/lib/api';
import type { I18nLanguage } from '@/shared/lib/i18n';
import type {
  ChatInputProductPluginData,
  ContextReferenceLocation,
} from './chat-input-product-plugin-adapters.types';
import {
  buildBackNavigationItem,
  buildCurrentDirectoryReferenceItem,
  buildFilesNavigationItem,
  buildFoldersNavigationItem,
  buildProjectReferenceItems,
  buildProjectsNavigationItem,
  buildSystemObjectGroupNavigationItems,
  buildWorkspaceReferenceItems,
  buildSystemObjectReferenceItems,
  FILES_SECTION_KEY,
  FILES_NAVIGATION_ITEM_KEY,
  FOLDERS_NAVIGATION_ITEM_KEY,
  FOLDERS_SECTION_KEY,
  PROJECTS_NAVIGATION_ITEM_KEY,
  ROOT_NAVIGATION_ITEM_KEY,
  SYSTEM_OBJECT_GROUP_ITEM_KEY_PREFIX,
  SYSTEM_OBJECT_ITEM_KEY_PREFIX,
  type ContextReferenceInputSurfaceTexts,
} from './context-reference-items.utils';
import {
  buildPanelAppReferenceItems,
  type PanelAppInputSurfaceItemTexts,
} from './panel-app-input-surface-items.utils';

export const CONTEXT_REFERENCE_TRIGGER_SPEC: ChatInputSurfaceTriggerSpec = {
  key: 'context-reference',
  marker: '@',
};

function buildWorkspaceItemSets(params: {
  entries: readonly ServerPathSearchEntryView[];
  isBrowsing: boolean;
  isFoldersMode: boolean;
  projectRoot: string;
  texts: ContextReferenceInputSurfaceTexts;
}) {
  const { entries, isBrowsing, isFoldersMode, projectRoot, texts } = params;
  const buildItems = (
    itemEntries: readonly ServerPathSearchEntryView[],
    kind: 'files' | 'folders',
    navigateDirectories: boolean,
  ) => buildWorkspaceReferenceItems({
    entries: itemEntries,
    navigateDirectories,
    projectRoot,
    sectionKey: kind === 'folders' ? FOLDERS_SECTION_KEY : FILES_SECTION_KEY,
    sectionLabel: kind === 'folders' ? texts.foldersLabel : texts.filesLabel,
    texts,
  });
  return {
    browsedItems: buildItems(entries, isFoldersMode ? 'folders' : 'files', isBrowsing),
    fileItems: buildItems(entries.filter(({ kind }) => kind === 'file'), 'files', false),
    folderItems: buildItems(entries.filter(({ kind }) => kind === 'directory'), 'folders', false),
  };
}

function handleContextReferenceItemSelect(params: {
  isFoldersMode: boolean;
  isWorkspaceMode: boolean;
  item: ChatInputSurfaceItem;
  onNavigate: (location: ContextReferenceLocation) => void;
  onSelectSystemObject: (uri: string) => void;
  referencePath: string;
}): void {
  const {
    isFoldersMode,
    isWorkspaceMode,
    item,
    onNavigate,
    onSelectSystemObject,
    referencePath,
  } = params;
  if (item.key === FILES_NAVIGATION_ITEM_KEY) {
    onNavigate({ view: 'files', path: '' });
  } else if (item.key === FOLDERS_NAVIGATION_ITEM_KEY) {
    onNavigate({ view: 'folders', path: '' });
  } else if (item.key === PROJECTS_NAVIGATION_ITEM_KEY) {
    onNavigate({ view: 'projects' });
  } else if (item.key === ROOT_NAVIGATION_ITEM_KEY) {
    onNavigate(
      isWorkspaceMode && referencePath
        ? { view: isFoldersMode ? 'folders' : 'files', path: item.value ?? '' }
        : { view: 'root' },
    );
  } else if (item.key.startsWith(SYSTEM_OBJECT_GROUP_ITEM_KEY_PREFIX) && item.value) {
    onNavigate({ view: 'system-objects', objectType: item.value });
  } else if (item.selectionBehavior === 'navigate' && item.value) {
    onNavigate({ view: isFoldersMode ? 'folders' : 'files', path: item.value });
  } else if (item.key.startsWith(SYSTEM_OBJECT_ITEM_KEY_PREFIX) && item.value) {
    onSelectSystemObject(item.value);
  }
}

export function createContextReferenceInputSurfacePlugin(params: {
  itemTexts: {
    context: ContextReferenceInputSurfaceTexts;
    panelApp: PanelAppInputSurfaceItemTexts;
  };
  menuTexts: ChatInputSurfaceMenuTexts;
  language: I18nLanguage;
  onNavigate: (location: ContextReferenceLocation) => void;
  onSelectSystemObject: (uri: string) => void;
}): ChatInputSurfacePlugin<ChatInputProductPluginData> {
  return createInputSurfaceTriggeredPanelPlugin({
    key: 'context-reference',
    trigger: CONTEXT_REFERENCE_TRIGGER_SPEC,
    resolvePanel: ({ data, trigger }) => {
      const isFilesMode = data.referenceLocation.view === 'files';
      const isFoldersMode = data.referenceLocation.view === 'folders';
      const isProjectsMode = data.referenceLocation.view === 'projects';
      const isSystemObjectsMode = data.referenceLocation.view === 'system-objects';
      const isWorkspaceMode = isFilesMode || isFoldersMode;
      const hasQuery = Boolean(trigger.query.trim());
      const isBrowsing = isWorkspaceMode && !hasQuery;
      const referencePath = data.referenceLocation.view === 'files' ||
        data.referenceLocation.view === 'folders'
        ? data.referenceLocation.path
        : '';
      const { browsedItems, fileItems, folderItems } = buildWorkspaceItemSets({
        entries: data.serverPathEntries,
        isBrowsing,
        isFoldersMode,
        projectRoot: data.projectRoot,
        texts: params.itemTexts.context,
      });
      const projectItems = buildProjectReferenceItems({
        projects: data.projects,
        query: trigger.query,
        texts: params.itemTexts.context,
      });
      const currentDirectoryItem = isFoldersMode && isBrowsing
        ? buildCurrentDirectoryReferenceItem({
            projectRoot: data.projectRoot,
            referencePath,
            texts: params.itemTexts.context,
          })
        : null;
      const systemObjectGroups = data.systemObjectGroups ?? [];
      const systemObjectItems = buildSystemObjectReferenceItems({
        groups: systemObjectGroups,
        language: params.language,
        texts: params.itemTexts.context,
      });
      const items = isFilesMode
        ? [
            buildBackNavigationItem({
              location: data.referenceLocation,
              texts: params.itemTexts.context,
            }),
            ...(isBrowsing ? browsedItems : fileItems),
          ]
        : isFoldersMode
          ? [
              buildBackNavigationItem({
                location: data.referenceLocation,
                texts: params.itemTexts.context,
              }),
              ...(currentDirectoryItem ? [currentDirectoryItem] : []),
              ...(isBrowsing ? browsedItems : folderItems),
            ]
        : isProjectsMode
          ? [
              buildBackNavigationItem({
                location: data.referenceLocation,
                texts: params.itemTexts.context,
              }),
              ...projectItems,
            ]
          : isSystemObjectsMode
            ? [
                buildBackNavigationItem({
                  location: data.referenceLocation,
                  texts: params.itemTexts.context,
                }),
                ...systemObjectItems,
              ]
          : [
            buildFilesNavigationItem(params.itemTexts.context),
            buildFoldersNavigationItem(params.itemTexts.context),
            buildProjectsNavigationItem(params.itemTexts.context),
            ...(hasQuery ? fileItems : []),
            ...(hasQuery ? folderItems : []),
            ...(hasQuery ? projectItems : []),
            ...(hasQuery
              ? systemObjectItems
              : buildSystemObjectGroupNavigationItems({
                  groups: systemObjectGroups,
                  language: params.language,
                  texts: params.itemTexts.context,
                })),
            ...buildPanelAppReferenceItems({
              entries: data.panelApps,
              query: trigger.query,
              sectionLabel: params.itemTexts.context.panelAppSectionLabel,
              texts: params.itemTexts.panelApp,
            }),
          ];
      const relevantLoading = isWorkspaceMode
        ? data.isServerPathSearchLoading
        : isProjectsMode
          ? data.isProjectsLoading
          : isSystemObjectsMode
            ? Boolean(data.isSystemObjectsLoading)
            : data.isPanelAppsLoading || Boolean(data.isSystemObjectsLoading) ||
              (hasQuery && (data.isProjectsLoading || data.isServerPathSearchLoading));
      const isRootMode = !isWorkspaceMode && !isProjectsMode && !isSystemObjectsMode;
      let errorMessage: string | null = null;
      if (isProjectsMode && data.projectsError) {
        errorMessage = `${params.itemTexts.context.projectsLoadFailedLabel}: ${data.projectsError}`;
      } else if ((isSystemObjectsMode || isRootMode) && data.systemObjectsError) {
        errorMessage = `${params.itemTexts.context.searchFailedLabel}: ${data.systemObjectsError}`;
      } else if ((isWorkspaceMode || isRootMode) && data.serverPathSearchError) {
        errorMessage = `${params.itemTexts.context.searchFailedLabel}: ${data.serverPathSearchError}`;
      }
      return {
        isLoading: isProjectsMode ? relevantLoading : relevantLoading && items.length === 0,
        items,
        notice: errorMessage
          ? {
              message: errorMessage,
              tone: 'error',
            }
          : undefined,
        onSelectItem: (item) => handleContextReferenceItemSelect({
          isFoldersMode,
          isWorkspaceMode,
          item,
          onNavigate: params.onNavigate,
          onSelectSystemObject: params.onSelectSystemObject,
          referencePath,
        }),
        texts: params.menuTexts,
      };
    },
  });
}
