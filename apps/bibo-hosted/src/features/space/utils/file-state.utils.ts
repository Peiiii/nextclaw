import type { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import type { BiboFile, BiboFileDetail } from "@nextclaw/bibo-client";

type WorkspaceState = ReturnType<typeof useBiboSpaceStore.getState>;

export function openedFileState(state: WorkspaceState, detail: BiboFileDetail, ancestors: BiboFile[], active: boolean): Partial<WorkspaceState> {
  const id = detail.id;
  const draft = state.fileDrafts[id];
  return {
    files: [...new Map([...state.files, ...ancestors, detail].map((file) => [file.id, file])).values()],
    fileDetails: { ...state.fileDetails, [id]: detail },
    fileDrafts: { ...state.fileDrafts, [id]: draft?.dirty || draft?.saving ? draft : { content: detail.content ?? "", version: detail.version, dirty: false, saving: false } },
    tabs: state.tabs.includes(id) ? state.tabs : [...state.tabs, id],
    ...(active ? { activeFileId: id, error: "" } : {}),
  };
}

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
