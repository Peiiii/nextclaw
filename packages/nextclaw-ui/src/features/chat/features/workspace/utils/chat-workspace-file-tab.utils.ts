import type { ChatFileOpenActionViewModel } from '@nextclaw/agent-chat-ui';
import type { ChatWorkspaceFileTab } from '@/features/chat/stores/chat-thread.store';
import { normalizeWorkspaceFilePreviewViewer } from './chat-workspace-file-viewer.utils';

export function createWorkspaceFileTab(
  action: ChatFileOpenActionViewModel,
  parentSessionKey: string | null,
): ChatWorkspaceFileTab | null {
  const path = action.path.trim();
  if (!path) {
    return null;
  }
  const normalizedParentSessionKey = parentSessionKey?.trim() || null;
  const previewViewer = action.viewMode === 'preview'
    ? normalizeWorkspaceFilePreviewViewer(path, action.previewViewer)
    : action.previewViewer ?? null;
  const viewIdentity = action.viewMode === 'preview' && previewViewer === 'rendered'
    ? 'preview:rendered'
    : action.viewMode;
  return {
    key: `${normalizedParentSessionKey ?? 'draft'}::${viewIdentity}::${path}`,
    parentSessionKey: normalizedParentSessionKey,
    path,
    label: action.label?.trim() || null,
    viewMode: action.viewMode,
    previewViewer,
    line: action.line ?? null,
    column: action.column ?? null,
    rawText: action.rawText ?? null,
    contentUrl: action.contentUrl?.trim() || null,
    mimeType: action.mimeType?.trim() || null,
    beforeText: action.beforeText ?? null,
    afterText: action.afterText ?? null,
    patchText: action.patchText ?? null,
    oldStartLine: action.oldStartLine ?? null,
    newStartLine: action.newStartLine ?? null,
    fullLines: action.fullLines,
  };
}

export function upsertWorkspaceFileTab(
  tabs: readonly ChatWorkspaceFileTab[],
  nextTab: ChatWorkspaceFileTab,
  adjacentToKey?: string,
): ChatWorkspaceFileTab[] {
  const existingIndex = tabs.findIndex((tab) => tab.key === nextTab.key);
  if (existingIndex !== -1) {
    const nextTabs = [...tabs];
    nextTabs[existingIndex] = { ...tabs[existingIndex], ...nextTab };
    return nextTabs;
  }
  const adjacentIndex = adjacentToKey
    ? tabs.findIndex((tab) => tab.key === adjacentToKey)
    : -1;
  if (adjacentIndex === -1) {
    return [nextTab, ...tabs];
  }
  return [
    ...tabs.slice(0, adjacentIndex + 1),
    nextTab,
    ...tabs.slice(adjacentIndex + 1),
  ];
}
