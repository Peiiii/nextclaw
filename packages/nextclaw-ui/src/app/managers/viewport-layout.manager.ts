import {
  createInitialViewportLayoutSnapshot,
  resolveViewportLayoutMode,
  useViewportLayoutStore,
  type ViewportLayoutSnapshot,
} from "@/app/stores/viewport-layout.store";

export const DENSE_RIGHT_PANELS_AUTO_COLLAPSE_MAX_WIDTH = 1800;

type DenseRightPanelsLayout = {
  isDocBrowserDocked: boolean;
  isDocBrowserOpen: boolean;
  isWorkspacePanelOpen: boolean;
};

export class ViewportLayoutManager {
  private consumerCount = 0;

  private started = false;

  attach = (): (() => void) => {
    this.consumerCount += 1;
    if (this.consumerCount === 1) {
      this.start();
    }

    return () => {
      this.consumerCount = Math.max(0, this.consumerCount - 1);
      if (this.consumerCount === 0) {
        this.stop();
      }
    };
  };

  start = () => {
    if (this.started || typeof window === "undefined") {
      return;
    }

    this.started = true;
    window.addEventListener("resize", this.handleViewportChange);
    window.addEventListener("orientationchange", this.handleViewportChange);
    this.syncFromWindow();
  };

  stop = () => {
    if (!this.started || typeof window === "undefined") {
      return;
    }

    window.removeEventListener("resize", this.handleViewportChange);
    window.removeEventListener("orientationchange", this.handleViewportChange);
    this.started = false;
  };

  getSnapshot = (): ViewportLayoutSnapshot => useViewportLayoutStore.getState();

  setSidebarCollapsed = (isSidebarCollapsed: boolean) => {
    useViewportLayoutStore.setState({ isSidebarCollapsed });
  };

  collapseSidebarForDenseRightPanels = (layout: DenseRightPanelsLayout) => {
    if (
      !layout.isDocBrowserOpen ||
      !layout.isDocBrowserDocked ||
      !layout.isWorkspacePanelOpen
    ) {
      return;
    }

    const snapshot = this.getSnapshot();
    if (snapshot.mode !== "desktop" || snapshot.isSidebarCollapsed) {
      return;
    }

    const width =
      typeof snapshot.width === "number"
        ? snapshot.width
        : typeof window === "undefined"
          ? null
          : window.innerWidth;
    if (
      typeof width !== "number" ||
      !Number.isFinite(width) ||
      width > DENSE_RIGHT_PANELS_AUTO_COLLAPSE_MAX_WIDTH
    ) {
      return;
    }

    this.setSidebarCollapsed(true);
  };

  toggleSidebarCollapsed = () => {
    useViewportLayoutStore.setState((state) => ({
      isSidebarCollapsed: !state.isSidebarCollapsed,
    }));
  };

  resetForTests = () => {
    this.consumerCount = 0;
    this.stop();
    useViewportLayoutStore.setState(createInitialViewportLayoutSnapshot());
  };

  private handleViewportChange = () => {
    this.syncFromWindow();
  };

  private syncFromWindow = () => {
    if (typeof window === "undefined") {
      return;
    }

    const width = window.innerWidth ?? null;
    useViewportLayoutStore.setState({
      width,
      mode: resolveViewportLayoutMode(width),
    });
  };
}

export const viewportLayoutManager = new ViewportLayoutManager();
