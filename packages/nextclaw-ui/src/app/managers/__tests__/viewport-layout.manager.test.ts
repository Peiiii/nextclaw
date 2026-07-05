import { beforeEach, describe, expect, it } from "vitest";
import {
  DENSE_RIGHT_PANELS_AUTO_COLLAPSE_MAX_WIDTH,
  viewportLayoutManager,
} from "@/app/managers/viewport-layout.manager";
import { useViewportLayoutStore } from "@/app/stores/viewport-layout.store";

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
  viewportLayoutManager.resetForTests();
}

describe("ViewportLayoutManager dense right panels", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setViewportWidth(DENSE_RIGHT_PANELS_AUTO_COLLAPSE_MAX_WIDTH);
  });

  it("collapses the left sidebar once when two docked right panels crowd a desktop viewport", () => {
    viewportLayoutManager.collapseSidebarForDenseRightPanels({
      isDocBrowserDocked: true,
      isDocBrowserOpen: true,
      isWorkspacePanelOpen: true,
    });

    expect(useViewportLayoutStore.getState().isSidebarCollapsed).toBe(true);
  });

  it("keeps the left sidebar expanded when only one right panel is open", () => {
    viewportLayoutManager.collapseSidebarForDenseRightPanels({
      isDocBrowserDocked: true,
      isDocBrowserOpen: true,
      isWorkspacePanelOpen: false,
    });

    expect(useViewportLayoutStore.getState().isSidebarCollapsed).toBe(false);
  });

  it("does not collapse the left sidebar for floating DocBrowser or wide desktop layouts", () => {
    viewportLayoutManager.collapseSidebarForDenseRightPanels({
      isDocBrowserDocked: false,
      isDocBrowserOpen: true,
      isWorkspacePanelOpen: true,
    });
    expect(useViewportLayoutStore.getState().isSidebarCollapsed).toBe(false);

    setViewportWidth(DENSE_RIGHT_PANELS_AUTO_COLLAPSE_MAX_WIDTH + 1);
    viewportLayoutManager.collapseSidebarForDenseRightPanels({
      isDocBrowserDocked: true,
      isDocBrowserOpen: true,
      isWorkspacePanelOpen: true,
    });
    expect(useViewportLayoutStore.getState().isSidebarCollapsed).toBe(false);
  });
});
