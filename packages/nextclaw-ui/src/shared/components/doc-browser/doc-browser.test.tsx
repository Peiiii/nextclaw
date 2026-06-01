import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocBrowser } from "@/shared/components/doc-browser/doc-browser";
import type { DocBrowserContextValue, DocBrowserTab } from "@/shared/components/doc-browser/doc-browser-context";
import { PANEL_APPS_DOC_BROWSER_RENDERERS } from "@/features/panel-apps";

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom") as object),
  useNavigate: () => navigateMock,
}));

const { docBrowserState } = vi.hoisted<{ docBrowserState: DocBrowserContextValue }>(() => ({
  docBrowserState: {
    isOpen: true,
    mode: "docked" as "docked" | "floating",
    tabs: [
      {
        id: "docs",
        kind: "docs" as const,
        title: "Docs",
        currentUrl: "https://docs.nextclaw.io/en/guide/getting-started",
        history: ["https://docs.nextclaw.io/en/guide/getting-started"],
        historyIndex: 0,
        navVersion: 0,
      },
    ],
    activeTabId: "docs",
    activeHistory: [{
      kind: "docs" as const,
      tabId: "docs",
      url: "https://docs.nextclaw.io/en/guide/getting-started",
    }],
    activeHistoryIndex: 0,
    currentTab: {
      id: "docs",
      kind: "docs" as const,
      title: "Docs",
      currentUrl: "https://docs.nextclaw.io/en/guide/getting-started",
      history: ["https://docs.nextclaw.io/en/guide/getting-started"],
      historyIndex: 0,
      navVersion: 0,
    },
    open: vi.fn(),
    openTarget: vi.fn(),
    openNewTab: vi.fn(),
    close: vi.fn(),
    toggleMode: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    navigate: vi.fn(),
    syncUrl: vi.fn(),
    setActiveTab: vi.fn(),
    closeTab: vi.fn(),
  },
}));

vi.mock("@/shared/components/doc-browser/doc-browser-context", async () => {
  const actual = await vi.importActual(
    "@/shared/components/doc-browser/doc-browser-context",
  );

  return {
    ...(actual as object),
    useDocBrowser: () => docBrowserState,
  };
});

function firePointerEvent(
  target: Window | Document | Node | Element,
  type: string,
  point: { clientX: number; clientY?: number; pointerId?: number },
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: point.clientX },
    clientY: { value: point.clientY ?? 0 },
    pointerId: { value: point.pointerId ?? 1 },
  });
  fireEvent(target, event);
}

describe("DocBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    docBrowserState.mode = "docked";
    docBrowserState.tabs = [
      {
        id: "docs",
        kind: "docs" as const,
        title: "Docs",
        currentUrl: "https://docs.nextclaw.io/en/guide/getting-started",
        history: ["https://docs.nextclaw.io/en/guide/getting-started"],
        historyIndex: 0,
        navVersion: 0,
      },
    ];
    docBrowserState.activeTabId = "docs";
    docBrowserState.activeHistory = [{
      kind: "docs" as const,
      tabId: "docs",
      url: "https://docs.nextclaw.io/en/guide/getting-started",
    }];
    docBrowserState.activeHistoryIndex = 0;
    docBrowserState.currentTab = docBrowserState.tabs[0];
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  it("uses the shared right panel resize handle in docked mode", () => {
    render(<DocBrowser />);

    expect(screen.getByTestId("doc-browser-panel").style.width).toBe("420px");
    expect(screen.getByTestId("resizable-right-panel-handle")).toBeTruthy();
  });

  it("uses a full viewport panel without desktop resize controls in fullscreen mode", () => {
    render(<DocBrowser displayMode="fullscreen" />);

    const panel = screen.getByTestId("doc-browser-panel");

    expect(panel.className).toContain("fixed");
    expect(panel.className).toContain("inset-0");
    expect(panel.className).toContain("w-screen");
    expect(
      screen.queryByTitle(/float/i) ?? screen.queryByTitle(/dock/i),
    ).toBeNull();
    expect(panel.querySelector(".cursor-ew-resize")).toBeNull();
    expect(panel.querySelector(".cursor-se-resize")).toBeNull();
  });

  it("keeps browser window controls on the tab strip", () => {
    render(<DocBrowser customTabRenderers={PANEL_APPS_DOC_BROWSER_RENDERERS} />);

    const tabStrip = screen.getByTestId("doc-browser-tab-strip");
    const tabActions = screen.getByTestId("doc-browser-tab-actions");

    expect(tabActions.contains(screen.getByTitle("Back"))).toBe(true);
    expect(tabActions.contains(screen.getByTitle("Forward"))).toBe(true);
    expect(tabStrip.contains(screen.getByTitle("Float Window"))).toBe(true);
    expect(tabStrip.contains(screen.getByTitle("Close"))).toBe(true);
    expect(tabActions.contains(screen.getByTitle("New Tab"))).toBe(true);
    expect(screen.queryByText("Embedded Browser")).toBeNull();
  });

  it("uses active history to enable browser back and forward actions", () => {
    const history = [
      "https://docs.nextclaw.io/en/guide/getting-started",
      "https://docs.nextclaw.io/en/guide/channels",
      "https://docs.nextclaw.io/en/guide/apps",
    ];
    const historyTab: DocBrowserTab = {
      id: "docs",
      kind: "docs",
      title: "Docs",
      currentUrl: history[1],
      history,
      historyIndex: 1,
      navVersion: 0,
    };
    docBrowserState.tabs = [historyTab];
    docBrowserState.activeTabId = historyTab.id;
    docBrowserState.activeHistory = [
      { kind: "home" as const, tabId: "home", url: "nextclaw://new-tab" },
      { kind: "docs" as const, tabId: historyTab.id, url: history[1] },
      { kind: "apps" as const, tabId: "apps", url: "nextclaw://apps" },
    ];
    docBrowserState.activeHistoryIndex = 1;
    docBrowserState.currentTab = historyTab;

    render(<DocBrowser customTabRenderers={PANEL_APPS_DOC_BROWSER_RENDERERS} />);

    fireEvent.click(screen.getByTitle("Back"));
    fireEvent.click(screen.getByTitle("Forward"));

    expect(docBrowserState.goBack).toHaveBeenCalled();
    expect(docBrowserState.goForward).toHaveBeenCalled();
  });

  it("disables browser history actions at the active history edges", () => {
    const history = [
      "https://docs.nextclaw.io/en/guide/getting-started",
      "https://docs.nextclaw.io/en/guide/apps",
    ];
    const latestTab: DocBrowserTab = {
      id: "docs",
      kind: "docs",
      title: "Docs",
      currentUrl: history[1],
      history,
      historyIndex: 1,
      navVersion: 0,
    };
    docBrowserState.tabs = [latestTab];
    docBrowserState.activeTabId = latestTab.id;
    docBrowserState.activeHistory = [
      { kind: "docs" as const, tabId: latestTab.id, url: history[0] },
      { kind: "docs" as const, tabId: latestTab.id, url: history[1] },
    ];
    docBrowserState.activeHistoryIndex = 1;
    docBrowserState.currentTab = latestTab;

    const { rerender } = render(<DocBrowser />);

    expect(screen.getByTitle("Back")).toHaveProperty("disabled", false);
    expect(screen.getByTitle("Forward")).toHaveProperty("disabled", true);

    const oldestTab: DocBrowserTab = {
      ...latestTab,
      currentUrl: history[0],
      historyIndex: 0,
    };
    docBrowserState.tabs = [oldestTab];
    docBrowserState.currentTab = oldestTab;
    docBrowserState.activeHistoryIndex = 0;
    rerender(<DocBrowser />);

    expect(screen.getByTitle("Back")).toHaveProperty("disabled", true);
    expect(screen.getByTitle("Forward")).toHaveProperty("disabled", false);
  });

  it("opens the start page from the fixed new tab action", () => {
    render(<DocBrowser />);

    fireEvent.click(screen.getByTitle("New Tab"));

    expect(docBrowserState.openNewTab).toHaveBeenCalled();
  });

  it("renders a start page for home tabs", () => {
    const homeTab: DocBrowserTab = {
      id: "home",
      kind: "home" as const,
      title: "Start Page",
      currentUrl: "nextclaw://new-tab",
      history: ["nextclaw://new-tab"],
      historyIndex: 0,
      navVersion: 0,
    };
    docBrowserState.tabs = [homeTab];
    docBrowserState.activeTabId = homeTab.id;
    docBrowserState.currentTab = homeTab;

    render(<DocBrowser customTabRenderers={PANEL_APPS_DOC_BROWSER_RENDERERS} />);

    expect(screen.getAllByText("Start Page").length).toBeGreaterThan(0);
    expect(screen.getByText("Apps")).toBeTruthy();
    expect(screen.getByText("Service Apps")).toBeTruthy();
    expect(screen.getByText("Help Docs")).toBeTruthy();
  });

  it("keeps the floating panel left edge stable when resizing from the right", () => {
    docBrowserState.mode = "floating";

    render(<DocBrowser />);

    firePointerEvent(screen.getByTestId("doc-browser-resize-right"), "pointerdown", {
      clientX: 1160,
      pointerId: 1,
    });
    firePointerEvent(window, "pointermove", { clientX: 1120, pointerId: 1 });

    const panel = screen.getByTestId("doc-browser-panel");
    expect(panel.style.left).toBe("680px");
    expect(panel.style.width).toBe("440px");
  });

  it("keeps the floating panel right edge stable when resizing from the left", () => {
    docBrowserState.mode = "floating";

    render(<DocBrowser />);

    firePointerEvent(screen.getByTestId("doc-browser-resize-left"), "pointerdown", {
      clientX: 680,
      pointerId: 1,
    });
    firePointerEvent(window, "pointermove", { clientX: 620, pointerId: 1 });

    const panel = screen.getByTestId("doc-browser-panel");
    expect(panel.style.left).toBe("620px");
    expect(panel.style.width).toBe("540px");
  });

  it("keeps the floating panel bottom edge stable when resizing from the top", () => {
    docBrowserState.mode = "floating";

    render(<DocBrowser />);

    firePointerEvent(screen.getByTestId("doc-browser-resize-top"), "pointerdown", {
      clientX: 900,
      clientY: 80,
      pointerId: 1,
    });
    firePointerEvent(window, "pointermove", {
      clientX: 900,
      clientY: 120,
      pointerId: 1,
    });

    const panel = screen.getByTestId("doc-browser-panel");
    expect(panel.style.top).toBe("120px");
    expect(panel.style.height).toBe("560px");
  });
});
