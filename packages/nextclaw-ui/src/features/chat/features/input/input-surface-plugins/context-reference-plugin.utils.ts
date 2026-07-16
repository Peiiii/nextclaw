import {
  createInputSurfaceTriggeredPanelPlugin,
  type ChatInputSurfaceItem,
  type ChatInputSurfaceMenuTexts,
  type ChatInputSurfacePlugin,
  type ChatInputSurfaceTriggerSpec,
} from '@nextclaw/agent-chat-ui';
import {
  CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
} from '@nextclaw/shared';
import type { PanelAppEntryView, ServerPathSearchEntryView } from '@/shared/lib/api';
import type {
  ChatInputProductPluginData,
  ContextReferenceMode,
} from './chat-input-product-plugin-adapters.types';
import {
  scoreInputSurfaceSearchCandidate,
  resolveInputSurfaceMatchTier,
} from './input-surface-search.utils';

const FILES_NAVIGATION_ITEM_KEY = 'context-reference:navigate:files';
const ROOT_NAVIGATION_ITEM_KEY = 'context-reference:navigate:root';
const WORKSPACE_SECTION_KEY = 'workspace';
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

export type ContextReferenceInputSurfaceTexts = {
  backLabel: string;
  backDescription: string;
  backHintLabel: string;
  directoryDescription: string;
  fileDescription: string;
  filesDescription: string;
  filesHintLabel: string;
  filesLabel: string;
  filesSubtitle: string;
  panelAppSectionLabel: string;
  projectRootLabel: string;
  searchFailedLabel: string;
  workspaceSectionLabel: string;
};

function getPanelAppActivityTime(entry: PanelAppEntryView): number {
  return Date.parse(entry.lastOpenedAt ?? entry.updatedAt) || 0;
}

function resolveProjectLabel(projectRoot: string): string {
  return projectRoot.split(/[\\/]+/).filter(Boolean).at(-1) ?? projectRoot;
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

function buildWorkspaceReferenceItems(params: {
  entries: readonly ServerPathSearchEntryView[];
  projectRoot: string;
  texts: ContextReferenceInputSurfaceTexts;
}): ChatInputSurfaceItem[] {
  const projectLabel = resolveProjectLabel(params.projectRoot);
  return params.entries.map((entry) => {
    const pathSegments = entry.relativePath.split('/').filter(Boolean);
    return {
      key: `workspace:${entry.kind}:${entry.relativePath}`,
      icon: entry.kind === 'directory' ? 'folder' : 'file',
      title: entry.name,
      subtitle: entry.parentRelativePath || projectLabel,
      description: entry.kind === 'directory'
        ? params.texts.directoryDescription
        : params.texts.fileDescription,
      detailLines: [
        `${params.texts.projectRootLabel}: ${params.projectRoot}`,
        entry.relativePath,
      ],
      sectionKey: WORKSPACE_SECTION_KEY,
      sectionLabel: params.texts.workspaceSectionLabel,
      tokenKind: entry.kind === 'directory'
        ? CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND
        : CHAT_WORKSPACE_FILE_TOKEN_KIND,
      tokenKey: entry.relativePath,
      pathPreview: {
        rootLabel: projectLabel,
        segments: pathSegments.map((label, index) => ({
          label,
          kind: index === pathSegments.length - 1 ? entry.kind : 'directory',
        })),
      },
    } satisfies ChatInputSurfaceItem;
  });
}

function buildFilesNavigationItem(texts: ContextReferenceInputSurfaceTexts): ChatInputSurfaceItem {
  return {
    key: FILES_NAVIGATION_ITEM_KEY,
    icon: 'files',
    title: texts.filesLabel,
    subtitle: texts.filesSubtitle,
    description: texts.filesDescription,
    detailLines: [],
    hintLabel: texts.filesHintLabel,
    selectionBehavior: 'navigate',
  };
}

function buildRootNavigationItem(texts: ContextReferenceInputSurfaceTexts): ChatInputSurfaceItem {
  return {
    key: ROOT_NAVIGATION_ITEM_KEY,
    icon: 'back',
    title: texts.backLabel,
    subtitle: '',
    description: texts.backDescription,
    detailLines: [],
    hintLabel: texts.backHintLabel,
    selectionBehavior: 'navigate',
  };
}

export function createContextReferenceInputSurfacePlugin(params: {
  itemTexts: {
    context: ContextReferenceInputSurfaceTexts;
    panelApp: PanelAppInputSurfaceItemTexts;
  };
  menuTexts: ChatInputSurfaceMenuTexts;
  onNavigate: (mode: ContextReferenceMode) => void;
}): ChatInputSurfacePlugin<ChatInputProductPluginData> {
  return createInputSurfaceTriggeredPanelPlugin({
    key: 'context-reference',
    trigger: CONTEXT_REFERENCE_TRIGGER_SPEC,
    resolvePanel: ({ data, trigger }) => {
      const workspaceItems = buildWorkspaceReferenceItems({
        entries: data.serverPathEntries,
        projectRoot: data.projectRoot,
        texts: params.itemTexts.context,
      });
      const items = data.referenceMode === 'files'
        ? [buildRootNavigationItem(params.itemTexts.context), ...workspaceItems]
        : [
            buildFilesNavigationItem(params.itemTexts.context),
            ...(trigger.query ? workspaceItems : []),
            ...buildPanelAppReferenceItems({
              entries: data.panelApps,
              query: trigger.query,
              sectionLabel: params.itemTexts.context.panelAppSectionLabel,
              texts: params.itemTexts.panelApp,
            }),
          ];
      const relevantLoading = data.referenceMode === 'files'
        ? data.isServerPathSearchLoading
        : data.isPanelAppsLoading || (Boolean(trigger.query) && data.isServerPathSearchLoading);
      return {
        isLoading: data.referenceMode === 'files'
          ? relevantLoading
          : relevantLoading && items.length === 0,
        items,
        notice: data.serverPathSearchError
          ? {
              message: `${params.itemTexts.context.searchFailedLabel}: ${data.serverPathSearchError}`,
              tone: 'error',
            }
          : undefined,
        onSelectItem: (item) => {
          if (item.key === FILES_NAVIGATION_ITEM_KEY) {
            params.onNavigate('files');
          } else if (item.key === ROOT_NAVIGATION_ITEM_KEY) {
            params.onNavigate('root');
          }
        },
        texts: params.menuTexts,
      };
    },
  });
}
