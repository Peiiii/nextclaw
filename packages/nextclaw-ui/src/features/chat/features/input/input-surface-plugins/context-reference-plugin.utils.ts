import {
  createInputSurfaceTriggeredPanelPlugin,
  type ChatInputSurfaceItem,
  type ChatInputSurfaceMenuTexts,
  type ChatInputSurfacePlugin,
  type ChatInputSurfaceTriggerSpec,
} from '@nextclaw/agent-chat-ui';
import type { PanelAppEntryView } from '@/shared/lib/api';
import type {
  ChatInputProductPluginData,
  ContextReferenceLocation,
} from './chat-input-product-plugin-adapters.types';
import {
  buildBackNavigationItem,
  buildCurrentDirectoryReferenceItem,
  buildFilesNavigationItem,
  buildProjectReferenceItems,
  buildProjectsNavigationItem,
  buildWorkspaceReferenceItems,
  FILES_NAVIGATION_ITEM_KEY,
  PROJECTS_NAVIGATION_ITEM_KEY,
  ROOT_NAVIGATION_ITEM_KEY,
  type ContextReferenceInputSurfaceTexts,
} from './context-reference-items.utils';
import {
  scoreInputSurfaceSearchCandidate,
  resolveInputSurfaceMatchTier,
} from './input-surface-search.utils';

const PANEL_APP_SECTION_KEY = 'panel-apps';

export const CONTEXT_REFERENCE_TRIGGER_SPEC: ChatInputSurfaceTriggerSpec = {
  key: 'context-reference',
  marker: '@',
};

export type PanelAppInputSurfaceItemTexts = {
  appIdLabel: string;
  fileLabel: string;
  noDescriptionLabel: string;
  subtitle: string;
};

function getPanelAppActivityTime(entry: PanelAppEntryView): number {
  return Date.parse(entry.lastOpenedAt ?? entry.updatedAt) || 0;
}

function resolvePanelAppInputSurfaceEntries(params: {
  entries: readonly PanelAppEntryView[];
  query: string;
}): PanelAppEntryView[] {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  return params.entries
    .map((entry, order) => ({
      entry,
      order,
      score: scoreInputSurfaceSearchCandidate(
        {
          id: entry.appId,
          label: entry.title || entry.appId,
          description: entry.description,
          aliases: [entry.id, entry.fileName],
        },
        params.query,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      const leftTier = resolveInputSurfaceMatchTier(left.score);
      const rightTier = resolveInputSurfaceMatchTier(right.score);
      if (rightTier !== leftTier) {
        return rightTier - leftTier;
      }
      if (left.entry.favorite !== right.entry.favorite) {
        return left.entry.favorite ? -1 : 1;
      }
      const rightActivity = getPanelAppActivityTime(right.entry);
      const leftActivity = getPanelAppActivityTime(left.entry);
      if (rightActivity !== leftActivity) {
        return rightActivity - leftActivity;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const labelCompare = collator.compare(left.entry.title || left.entry.appId, right.entry.title || right.entry.appId);
      return labelCompare || left.order - right.order;
    })
    .map(({ entry }) => entry);
}

function buildPanelAppInputSurfaceItemEntries(params: {
  entries: readonly PanelAppEntryView[];
  keyPrefix?: string;
  query: string;
  texts: PanelAppInputSurfaceItemTexts;
}): Array<{ entry: PanelAppEntryView; item: ChatInputSurfaceItem }> {
  const keyPrefix = params.keyPrefix ?? 'panel-app';
  return resolvePanelAppInputSurfaceEntries({
    entries: params.entries,
    query: params.query,
  }).map((entry) => ({
    entry,
    item: {
      key: `${keyPrefix}:${entry.appId}`,
      icon: 'panel-app',
      title: entry.title || entry.appId,
      subtitle: params.texts.subtitle,
      description: (entry.description ?? '').trim() || params.texts.noDescriptionLabel,
      detailLines: [
        `${params.texts.appIdLabel}: ${entry.appId}`,
        `${params.texts.fileLabel}: ${entry.fileName}`,
      ],
    },
  }));
}

export function buildPanelAppInputSurfaceItems(params: {
  entries: readonly PanelAppEntryView[];
  keyPrefix?: string;
  query: string;
  texts: PanelAppInputSurfaceItemTexts;
}): ChatInputSurfaceItem[] {
  return buildPanelAppInputSurfaceItemEntries(params).map(({ item }) => item);
}

function buildPanelAppReferenceItems(params: {
  entries: readonly PanelAppEntryView[];
  query: string;
  sectionLabel: string;
  texts: PanelAppInputSurfaceItemTexts;
}): ChatInputSurfaceItem[] {
  return buildPanelAppInputSurfaceItemEntries(params).map(({ entry, item }) => ({
    ...item,
    sectionKey: PANEL_APP_SECTION_KEY,
    sectionLabel: params.sectionLabel,
    tokenKind: 'panel_app',
    tokenKey: entry.appId,
    value: entry.appId,
  }));
}

export function createContextReferenceInputSurfacePlugin(params: {
  itemTexts: {
    context: ContextReferenceInputSurfaceTexts;
    panelApp: PanelAppInputSurfaceItemTexts;
  };
  menuTexts: ChatInputSurfaceMenuTexts;
  onNavigate: (location: ContextReferenceLocation) => void;
}): ChatInputSurfacePlugin<ChatInputProductPluginData> {
  return createInputSurfaceTriggeredPanelPlugin({
    key: 'context-reference',
    trigger: CONTEXT_REFERENCE_TRIGGER_SPEC,
    resolvePanel: ({ data, trigger }) => {
      const isFilesMode = data.referenceLocation.view === 'files';
      const isProjectsMode = data.referenceLocation.view === 'projects';
      const isBrowsing = isFilesMode && !trigger.query.trim();
      const referencePath = data.referenceLocation.view === 'files'
        ? data.referenceLocation.path
        : '';
      const workspaceItems = buildWorkspaceReferenceItems({
        entries: data.serverPathEntries,
        navigateDirectories: isBrowsing,
        projectRoot: data.projectRoot,
        texts: params.itemTexts.context,
      });
      const projectItems = buildProjectReferenceItems({
        projects: data.projects,
        query: trigger.query,
        texts: params.itemTexts.context,
      });
      const currentDirectoryItem = isBrowsing && referencePath
        ? buildCurrentDirectoryReferenceItem({
            projectRoot: data.projectRoot,
            referencePath,
            texts: params.itemTexts.context,
          })
        : null;
      const items = isFilesMode
        ? [
            buildBackNavigationItem({
              location: data.referenceLocation,
              texts: params.itemTexts.context,
            }),
            ...(currentDirectoryItem ? [currentDirectoryItem] : []),
            ...workspaceItems,
          ]
        : isProjectsMode
          ? [
              buildBackNavigationItem({
                location: data.referenceLocation,
                texts: params.itemTexts.context,
              }),
              ...projectItems,
            ]
          : [
            buildFilesNavigationItem(params.itemTexts.context),
            buildProjectsNavigationItem(params.itemTexts.context),
            ...(trigger.query ? workspaceItems : []),
            ...(trigger.query ? projectItems : []),
            ...buildPanelAppReferenceItems({
              entries: data.panelApps,
              query: trigger.query,
              sectionLabel: params.itemTexts.context.panelAppSectionLabel,
              texts: params.itemTexts.panelApp,
            }),
          ];
      const relevantLoading = isFilesMode
        ? data.isServerPathSearchLoading
        : isProjectsMode
          ? data.isProjectsLoading
          : data.isPanelAppsLoading ||
            (Boolean(trigger.query) && (data.isProjectsLoading || data.isServerPathSearchLoading));
      const errorMessage = isProjectsMode && data.projectsError
        ? `${params.itemTexts.context.projectsLoadFailedLabel}: ${data.projectsError}`
        : data.serverPathSearchError
          ? `${params.itemTexts.context.searchFailedLabel}: ${data.serverPathSearchError}`
          : null;
      return {
        isLoading: isProjectsMode ? relevantLoading : relevantLoading && items.length === 0,
        items,
        notice: errorMessage
          ? {
              message: errorMessage,
              tone: 'error',
            }
          : undefined,
        onSelectItem: (item) => {
          if (item.key === FILES_NAVIGATION_ITEM_KEY) {
            params.onNavigate({ view: 'files', path: '' });
          } else if (item.key === PROJECTS_NAVIGATION_ITEM_KEY) {
            params.onNavigate({ view: 'projects' });
          } else if (item.key === ROOT_NAVIGATION_ITEM_KEY) {
            params.onNavigate(
              isFilesMode && referencePath
                ? { view: 'files', path: item.value ?? '' }
                : { view: 'root' },
            );
          } else if (item.selectionBehavior === 'navigate' && item.value) {
            params.onNavigate({ view: 'files', path: item.value });
          }
        },
        texts: params.menuTexts,
      };
    },
  });
}
