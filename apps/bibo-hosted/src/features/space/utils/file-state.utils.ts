import type { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import type { BiboFile, BiboFileDetail } from "@nextclaw/bibo-client";

type WorkspaceState = ReturnType<typeof useBiboSpaceStore.getState>;

export function restoredFileTargets(state: WorkspaceState, view: WorkspaceState["view"]) {
  const active = state.activeFileId;
  const selected = active && !state.fileDetails[active] && (view === "files" || state.notes.some((note) => note.id === active))
    ? [{ id: active, select: true }] : [];
  const workspace = state.workspaceFileId;
  if (state.workspaceOpen && workspace && !state.fileDetails[workspace] && !selected.some((file) => file.id === workspace)) selected.push({ id: workspace, select: false });
  return selected;
}

export function savedFileState(state: WorkspaceState, detail: BiboFileDetail, submittedContent: string): Partial<WorkspaceState> {
  const id = detail.id;
  const current = state.fileDrafts[id];
  if (!current) return {};
  const editedDuringSave = current.content !== submittedContent;
  return {
    fileDetails: { ...state.fileDetails, [id]: detail },
    fileDrafts: { ...state.fileDrafts, [id]: { content: editedDuringSave ? current.content : detail.content ?? "", version: detail.version, dirty: editedDuringSave, saving: false } },
  };
}

export function closedFileState(state: WorkspaceState, id: string): Partial<WorkspaceState> {
  const tabs = state.tabs.filter((tab) => tab !== id);
  const fileDetails = { ...state.fileDetails }; delete fileDetails[id];
  const fileDrafts = { ...state.fileDrafts }; delete fileDrafts[id];
  const neighbor = state.tabs[state.tabs.indexOf(id) + 1] ?? state.tabs[state.tabs.indexOf(id) - 1] ?? null;
  const activeNeighbor = state.view === "notes" ? tabs.find((tab) =>
    (state.fileDetails[tab] ?? state.files.find((file) => file.id === tab))?.kind === "note") ?? null : neighbor;
  return {
    tabs, fileDetails, fileDrafts, activeFileId: state.activeFileId === id ? activeNeighbor : state.activeFileId,
    fileBrowserVisible: tabs.length === 0 || state.activeFileId === id && !activeNeighbor ? true : state.fileBrowserVisible,
    ...(state.workspaceFileId === id ? { workspaceFileId: neighbor, workspacePreview: null } : {}),
  };
}

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
