import {
  createInitialViewportLayoutSnapshot,
  resolveViewportLayoutMode,
  useViewportLayoutStore,
  type ViewportLayoutSnapshot,
} from "@/app/stores/viewport-layout.store";

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
