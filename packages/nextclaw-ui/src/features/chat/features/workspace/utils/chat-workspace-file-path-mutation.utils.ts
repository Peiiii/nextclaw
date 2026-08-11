import type { ChatThreadSnapshot, ChatWorkspaceNavigationEntry } from '@/features/chat/stores/chat-thread.store';
import { closeWorkspaceTabSnapshot } from '@/features/chat/features/workspace/utils/chat-thread-workspace-session.utils';
import { replaceWorkspaceFileTabPath } from '@/features/chat/features/workspace/utils/chat-workspace-file-tab.utils';

function replaceWorkspacePathPrefix(candidate: string, previousPath: string, nextPath: string): string | null {
  if (candidate === previousPath) return nextPath;
  if (candidate.startsWith(`${previousPath}/`) || candidate.startsWith(`${previousPath}\\`)) {
    return `${nextPath}${candidate.slice(previousPath.length)}`;
  }
  return null;
}

export function createRenamedWorkspacePathPatch(
  snapshot: ChatThreadSnapshot,
  params: { previousPath: string; path: string; label: string },
): Partial<ChatThreadSnapshot> | null {
  const previousPath = params.previousPath.trim();
  const path = params.path.trim();
  if (!previousPath || !path || previousPath === path) return null;

  const keyMap = new Map<string, string>();
  const workspaceFileTabs = snapshot.workspaceFileTabs.map((tab) => {
    const nextPath = replaceWorkspacePathPrefix(tab.path, previousPath, path);
    if (!nextPath) return tab;
    const nextTab = replaceWorkspaceFileTabPath(tab, nextPath, tab.path === previousPath ? params.label : tab.label);
    keyMap.set(tab.key, nextTab.key);
    return nextTab;
  });
  if (keyMap.size === 0) return null;

  const remapEntry = (entry: ChatWorkspaceNavigationEntry): ChatWorkspaceNavigationEntry =>
    entry.kind === 'file' && keyMap.has(entry.key) ? { kind: 'file', key: keyMap.get(entry.key)! } : entry;
  return {
    workspaceFileTabs,
    activeWorkspaceFileKey: snapshot.activeWorkspaceFileKey
      ? (keyMap.get(snapshot.activeWorkspaceFileKey) ?? snapshot.activeWorkspaceFileKey)
      : null,
    closedWorkspaceTabEntries: snapshot.closedWorkspaceTabEntries.map(remapEntry),
    workspaceNavigationHistory: snapshot.workspaceNavigationHistory.map(remapEntry),
  };
}

export function createRemovedWorkspacePathSnapshot(
  snapshot: ChatThreadSnapshot,
  path: string,
): ChatThreadSnapshot | null {
  const normalizedPath = path.trim();
  if (!normalizedPath) return null;
  let nextSnapshot = snapshot;
  const matchingKeys = snapshot.workspaceFileTabs
    .filter((tab) => replaceWorkspacePathPrefix(tab.path, normalizedPath, normalizedPath) !== null)
    .map((tab) => tab.key);
  for (const key of matchingKeys) {
    const patch = closeWorkspaceTabSnapshot(nextSnapshot, { kind: 'file', key });
    if (patch) nextSnapshot = { ...nextSnapshot, ...patch };
  }
  return matchingKeys.length > 0 ? nextSnapshot : null;
}
