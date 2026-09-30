import type { BiboFile } from "@nextclaw/bibo-client";

export type BiboTheme = "classic" | "neutral";
const themeKey = "bibo-ui-theme";

export function readBiboTheme(): BiboTheme {
  try { return localStorage.getItem(themeKey) === "neutral" ? "neutral" : "classic"; }
  catch { return "classic"; }
}

export function writeBiboTheme(theme: BiboTheme): void {
  try { localStorage.setItem(themeKey, theme); }
  catch { /* The selected theme still works for the current visit. */ }
}

export function revealedFileLayout(state: {
  files: BiboFile[]; fileDetails: Record<string, BiboFile>; expandedFolders: Record<string, boolean>;
  view?: string;
}, id: string) {
  const file = state.files.find((item) => item.id === id) ?? state.fileDetails[id];
  if (!file) return {};
  if (state.view === "notes" && file.kind !== "note") return { fileBrowserVisible: true };
  const expandedFolders = { ...state.expandedFolders };
  for (const folder of state.files) if (folder.kind === "folder" && file.path.startsWith(`${folder.path}/`)) expandedFolders[folder.id] = true;
  return { expandedFolders, fileBrowserVisible: false, fileQuery: "", fileMatches: [], fileSearchLoading: false };
}

type WorkspaceLayout = {
  sidebarCollapsed: boolean;
  treeCollapsed: boolean;
  treeWidth: number;
  expandedFolders: Record<string, boolean>;
  tabs: string[];
  activeFileId: string | null;
  workspaceOpen: boolean;
  workspaceFileId: string | null;
};

export function readWorkspaceLayout(accountId: string): Partial<WorkspaceLayout> {
  try {
    const layout = JSON.parse(localStorage.getItem(`space-layout:${accountId}`) ?? "null");
    if (!layout || typeof layout !== "object") return {};
    const tabs: string[] = Array.isArray(layout.tabs)
      ? layout.tabs.filter((id: unknown) => typeof id === "string").slice(0, 50) : [];
    return {
      sidebarCollapsed: layout.sidebarCollapsed === true,
      treeCollapsed: window.matchMedia?.("(min-width: 761px)").matches === true && layout.treeCollapsed === true,
      treeWidth: Math.min(360, Math.max(180, Number(layout.treeWidth) || 230)),
      expandedFolders: Object.fromEntries(Object.entries(layout.expandedFolders ?? {}).filter(([, value]) => value === true).map(([id]) => [id, true])),
      tabs,
      activeFileId: tabs.includes(layout.activeFileId) ? layout.activeFileId : null,
      workspaceOpen: layout.workspaceOpen === true,
      workspaceFileId: typeof layout.workspaceFileId === "string" ? layout.workspaceFileId : null,
    };
  } catch { return {}; }
}

export function writeWorkspaceLayout(layout: WorkspaceLayout & { accountId: string | null }): void {
  const { accountId, sidebarCollapsed, treeCollapsed, treeWidth, expandedFolders, tabs, activeFileId, workspaceOpen, workspaceFileId } = layout;
  if (!accountId) return;
  try {
    localStorage.setItem(`space-layout:${accountId}`, JSON.stringify({ sidebarCollapsed, treeCollapsed, treeWidth, expandedFolders, tabs, activeFileId, workspaceOpen, workspaceFileId }));
  } catch { /* Preferences are optional; user content never goes into this storage. */ }
}
