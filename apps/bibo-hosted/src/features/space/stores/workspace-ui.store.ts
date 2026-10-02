import { create, type StoreApi } from "zustand";
import { readBiboTheme, readWorkspaceUiLayout, writeBiboTheme, writeWorkspaceUiLayout, type BiboTheme } from "@/features/space/utils/workspace-layout.utils";

class WorkspaceUiOwner {
  theme = readBiboTheme();
  sidebarCollapsed = false;
  treeCollapsed = false;
  treeWidth = 230;
  workspaceRatio = 0.55;

  constructor(private readonly store: StoreApi<WorkspaceUiOwner>) {
    Object.assign(this, readWorkspaceUiLayout());
    this.treeCollapsed = typeof window !== "undefined" && window.matchMedia?.("(min-width: 761px)").matches === true && this.treeCollapsed;
  }

  setTheme = (theme: BiboTheme): void => { this.store.setState({ theme }); writeBiboTheme(theme); };
  toggleSidebar = (): void => {
    this.store.setState((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
    writeWorkspaceUiLayout({ sidebarCollapsed: this.store.getState().sidebarCollapsed });
  };
  toggleTree = (): void => {
    this.store.setState((state) => ({ treeCollapsed: !state.treeCollapsed }));
    writeWorkspaceUiLayout({ treeCollapsed: this.store.getState().treeCollapsed });
  };
  resizeTree = (width: number): void => {
    this.store.setState({ treeWidth: Math.min(360, Math.max(180, width)) });
    writeWorkspaceUiLayout({ treeWidth: this.store.getState().treeWidth });
  };
  resizeWorkspace = (ratio: number): void => {
    if (!Number.isFinite(ratio)) return;
    this.store.setState({ workspaceRatio: Math.min(0.7, Math.max(0.3, ratio)) });
    writeWorkspaceUiLayout({ workspaceRatio: this.store.getState().workspaceRatio });
  };
}

export const useWorkspaceUiStore = create<WorkspaceUiOwner>((_set, _get, store) => new WorkspaceUiOwner(store));
