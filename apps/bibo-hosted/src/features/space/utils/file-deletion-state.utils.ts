import type { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";

type WorkspaceState = ReturnType<typeof useBiboSpaceStore.getState>;

export function fileDeletionState(current: WorkspaceState, removed: ReadonlySet<string>): Partial<WorkspaceState> {
  const index = current.tabs.indexOf(current.activeFileId ?? "");
  const tabs = current.tabs.filter((id) => !removed.has(id));
  const activeFileId = current.activeFileId && !removed.has(current.activeFileId)
    ? current.activeFileId
    : current.tabs.slice(index + 1).find((id) => !removed.has(id)) ?? current.tabs.slice(0, index).reverse().find((id) => !removed.has(id)) ?? null;
  return {
    tabs, activeFileId,
    fileDetails: Object.fromEntries(Object.entries(current.fileDetails).filter(([id]) => !removed.has(id))),
    fileDrafts: Object.fromEntries(Object.entries(current.fileDrafts).filter(([id]) => !removed.has(id))),
    expandedFolders: Object.fromEntries(Object.entries(current.expandedFolders).filter(([id]) => !removed.has(id))),
    fileBrowserVisible: tabs.length === 0 || current.fileBrowserVisible,
    ...(current.workspaceFileId && removed.has(current.workspaceFileId) ? { workspaceOpen: false, workspaceFileId: null } : {}),
  };
}
