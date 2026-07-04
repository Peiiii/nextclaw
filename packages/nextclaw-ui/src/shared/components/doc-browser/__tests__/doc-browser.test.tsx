import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocBrowser } from "@/shared/components/doc-browser/doc-browser";
import { DocBrowserTabStrip } from "@/shared/components/doc-browser/doc-browser-tab-strip";
import type {
  DocBrowserContextValue,
  DocBrowserTab,
} from "@/shared/components/doc-browser/doc-browser-context";
import { PANEL_APPS_DOC_BROWSER_RENDERERS } from "@/features/panel-apps";

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => ({
  ...((await vi.importActual("react-router-dom")) as object),
  useNavigate: () => navigateMock,
}));

const { docBrowserState } = vi.hoisted<{
  docBrowserState: DocBrowserContextValue;
}>(() => ({
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
    activeHistory: [
      {
        kind: "docs" as const,
        tabId: "docs",
        url: "https://docs.nextclaw.io/en/guide/getting-started",
      },
    ],
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

class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

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
  const event = new window.PointerEvent(type, {
    bubbles: true,
    clientX: point.clientX,
    clientY: point.clientY ?? 0,
    pointerId: point.pointerId ?? 1,
  });
  fireEvent(target, event);
}

function resetDocBrowserTestState() {
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
  docBrowserState.activeHistory = [
    {
      kind: "docs" as const,
      tabId: "docs",
      url: "https://docs.nextclaw.io/en/guide/getting-started",
    },
  ];
  docBrowserState.activeHistoryIndex = 0;
  docBrowserState.currentTab = docBrowserState.tabs[0];
}

function installDocBrowserPointerTestEnvironment() {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1200,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 900,
  });
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    value: TestPointerEvent,
  });
  HTMLElement.prototype.setPointerCapture = vi.fn();
}

describe("DocBrowser", () => {
  beforeEach(() => {
    resetDocBrowserTestState();
    installDocBrowserPointerTestEnvironment();
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
      screen.queryByRole("button", { name: /float/i }) ??
        screen.queryByRole("button", { name: /dock/i }),
    ).toBeNull();
    expect(panel.querySelector(".cursor-ew-resize")).toBeNull();
    expect(panel.querySelector(".cursor-se-resize")).toBeNull();
  });

  it("keeps browser window controls on the tab strip", async () => {
    const user = userEvent.setup();
    render(
      <DocBrowser customTabRenderers={PANEL_APPS_DOC_BROWSER_RENDERERS} />,
    );

    const tabStrip = screen.getByTestId("doc-browser-tab-strip");
    const tabActions = screen.getByTestId("doc-browser-tab-actions");
    const floatButton = screen.getByRole("button", { name: "Float Window" });
    const newTabButton = screen.getByRole("button", { name: "New Tab" });

    expect(
      tabActions.contains(screen.getByRole("button", { name: "Back" })),
    ).toBe(true);
    expect(
      tabActions.contains(screen.getByRole("button", { name: "Forward" })),
    ).toBe(true);
    expect(
      tabStrip.contains(floatButton),
    ).toBe(true);
    expect(floatButton.querySelector(".lucide-picture-in-picture2")).toBeTruthy();
    expect(floatButton.querySelector(".lucide-maximize2")).toBeNull();
    expect(
      tabStrip.contains(screen.getByRole("button", { name: "Close" })),
    ).toBe(true);
    expect(tabActions.contains(newTabButton)).toBe(true);
    expect(screen.queryByText("Embedded Browser")).toBeNull();

    await user.hover(newTabButton);

    expect((await screen.findAllByText("New Tab")).length).toBeGreaterThan(0);
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

    render(
      <DocBrowser customTabRenderers={PANEL_APPS_DOC_BROWSER_RENDERERS} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));

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

    expect(screen.getByRole("button", { name: "Back" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByRole("button", { name: "Forward" })).toHaveProperty(
      "disabled",
      true,
    );

    const oldestTab: DocBrowserTab = {
      ...latestTab,
      currentUrl: history[0],
      historyIndex: 0,
    };
    docBrowserState.tabs = [oldestTab];
    docBrowserState.currentTab = oldestTab;
    docBrowserState.activeHistoryIndex = 0;
    rerender(<DocBrowser />);

    expect(screen.getByRole("button", { name: "Back" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Forward" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("opens the start page from the fixed new tab action", () => {
    render(<DocBrowser />);

    fireEvent.click(screen.getByRole("button", { name: "New Tab" }));

    expect(docBrowserState.openNewTab).toHaveBeenCalled();
  });

  it("pins the current tab through injected dock controls", () => {
    const pinTab = vi.fn();
    const unpinTab = vi.fn();

    render(
      <DocBrowser
        dockControls={{
          getDockState: () => ({
            canDock: true,
            isDocked: false,
            removable: false,
          }),
          pinTab,
          unpinTab,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pin to SideDock" }));

    expect(pinTab).toHaveBeenCalledWith(docBrowserState.currentTab);
    expect(unpinTab).not.toHaveBeenCalled();
  });

  it("unpins a removable docked tab through injected dock controls", () => {
    const pinTab = vi.fn();
    const unpinTab = vi.fn();

    render(
      <DocBrowser
        dockControls={{
          getDockState: () => ({
            canDock: true,
            isDocked: true,
            removable: true,
          }),
          pinTab,
          unpinTab,
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remove from SideDock" }),
    );

    expect(unpinTab).toHaveBeenCalledWith(docBrowserState.currentTab);
    expect(pinTab).not.toHaveBeenCalled();
  });

  it("disables dock controls for built-in shortcuts", () => {
    render(
      <DocBrowser
        dockControls={{
          getDockState: () => ({
            canDock: true,
            isDocked: true,
            removable: false,
          }),
          pinTab: vi.fn(),
          unpinTab: vi.fn(),
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Built-in shortcut" }),
    ).toHaveProperty("disabled", true);
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

    render(
      <DocBrowser customTabRenderers={PANEL_APPS_DOC_BROWSER_RENDERERS} />,
    );

    expect(screen.getAllByText("Start Page").length).toBeGreaterThan(0);
    expect(screen.getByText("Apps")).toBeTruthy();
    expect(screen.getByText("Service Apps")).toBeTruthy();
    expect(screen.getByText("Help Docs")).toBeTruthy();
  });

});

describe("DocBrowser floating interactions", () => {
  beforeEach(() => {
    resetDocBrowserTestState();
    installDocBrowserPointerTestEnvironment();
  });

  it("starts floating drag from the header background without stealing tab actions", () => {
    const onDragStart = vi.fn();

    render(
      <DocBrowserTabStrip
        tabs={docBrowserState.tabs}
        activeTabId="docs"
        canGoBack={false}
        canGoForward={false}
        isDocked={false}
        isFullscreen={false}
        onGoBack={vi.fn()}
        onGoForward={vi.fn()}
        onOpenNewTab={vi.fn()}
        onSetActiveTab={vi.fn()}
        onCloseTab={vi.fn()}
        onClose={vi.fn()}
        onDragStart={onDragStart}
        onToggleMode={vi.fn()}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Docs" }));
    expect(onDragStart).not.toHaveBeenCalled();

    const tabStrip = screen.getByTestId("doc-browser-tab-strip");
    const headerDragSurface = tabStrip.querySelector(".doc-browser-tab-scrollbar");
    expect(headerDragSurface).toBeInstanceOf(HTMLElement);
    expect((headerDragSurface as HTMLElement).className).toContain("cursor-grab");
    expect(screen.getByRole("button", { name: "Docs" }).parentElement?.className).toContain("cursor-pointer");

    fireEvent.pointerDown(headerDragSurface as HTMLElement);

    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it("keeps the floating panel left edge stable when resizing from the right", () => {
    docBrowserState.mode = "floating";

    render(<DocBrowser />);

    firePointerEvent(
      screen.getByTestId("doc-browser-resize-right"),
      "pointerdown",
      {
        clientX: 1160,
        pointerId: 1,
      },
    );
    firePointerEvent(window, "pointermove", { clientX: 1120, pointerId: 1 });

    const panel = screen.getByTestId("doc-browser-panel");
    expect(panel.style.left).toBe("680px");
    expect(panel.style.width).toBe("440px");
  });

  it("keeps the floating panel right edge stable when resizing from the left", () => {
    docBrowserState.mode = "floating";

    render(<DocBrowser />);

    firePointerEvent(
      screen.getByTestId("doc-browser-resize-left"),
      "pointerdown",
      {
        clientX: 680,
        pointerId: 1,
      },
    );
    firePointerEvent(window, "pointermove", { clientX: 620, pointerId: 1 });

    const panel = screen.getByTestId("doc-browser-panel");
    expect(panel.style.left).toBe("620px");
    expect(panel.style.width).toBe("540px");
  });

  it("keeps the floating panel bottom edge stable when resizing from the top", () => {
    docBrowserState.mode = "floating";

    render(<DocBrowser />);

    firePointerEvent(
      screen.getByTestId("doc-browser-resize-top"),
      "pointerdown",
      {
        clientX: 900,
        clientY: 80,
        pointerId: 1,
      },
    );
    firePointerEvent(window, "pointermove", {
      clientX: 900,
      clientY: 120,
      pointerId: 1,
    });

    const panel = screen.getByTestId("doc-browser-panel");
    expect(panel.style.top).toBe("120px");
    expect(panel.style.height).toBe("560px");
  });

  it("resizes the floating panel from the bottom-left corner", () => {
    docBrowserState.mode = "floating";

    render(<DocBrowser />);

    firePointerEvent(
      screen.getByTestId("doc-browser-resize-bottom-left"),
      "pointerdown",
      {
        clientX: 680,
        clientY: 680,
        pointerId: 1,
      },
    );
    firePointerEvent(window, "pointermove", {
      clientX: 620,
      clientY: 720,
      pointerId: 1,
    });

    const panel = screen.getByTestId("doc-browser-panel");
    expect(panel.style.left).toBe("620px");
    expect(panel.style.top).toBe("80px");
    expect(panel.style.width).toBe("540px");
    expect(panel.style.height).toBe("640px");
  });

  it("resizes the floating panel from the top-right corner", () => {
    docBrowserState.mode = "floating";

    render(<DocBrowser />);

    firePointerEvent(
      screen.getByTestId("doc-browser-resize-top-right"),
      "pointerdown",
      {
        clientX: 1160,
        clientY: 80,
        pointerId: 1,
      },
    );
    firePointerEvent(window, "pointermove", {
      clientX: 1120,
      clientY: 120,
      pointerId: 1,
    });

    const panel = screen.getByTestId("doc-browser-panel");
    expect(panel.style.left).toBe("680px");
    expect(panel.style.top).toBe("120px");
    expect(panel.style.width).toBe("440px");
    expect(panel.style.height).toBe("560px");
  });
});

describe("DocBrowser content tabs", () => {
  beforeEach(() => {
    resetDocBrowserTestState();
  });

  it("shows browser controls for content iframe tabs", () => {
    const contentTab: DocBrowserTab = {
      id: "local-app",
      kind: "content",
      title: "Local App",
      currentUrl: "http://127.0.0.1:5173/dashboard",
      history: ["http://127.0.0.1:5173/dashboard"],
      historyIndex: 0,
      navVersion: 0,
    };
    docBrowserState.tabs = [contentTab];
    docBrowserState.activeTabId = contentTab.id;
    docBrowserState.currentTab = contentTab;
    docBrowserState.activeHistory = [
      {
        kind: "content",
        tabId: contentTab.id,
        url: contentTab.currentUrl,
      },
    ];

    render(<DocBrowser />);

    const addressInput = screen.getByRole("textbox", { name: "Address" }) as HTMLInputElement;
    const iframe = screen.getByTitle("Local App") as HTMLIFrameElement;
    const externalLink = screen.getByRole("link", { name: /Open in Browser/i }) as HTMLAnchorElement;

    expect(addressInput.value).toBe("http://127.0.0.1:5173/dashboard");
    expect(iframe.getAttribute("src")).toBe(contentTab.currentUrl);
    expect(iframe.getAttribute("sandbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(externalLink.getAttribute("href")).toBe(contentTab.currentUrl);

    fireEvent.change(addressInput, { target: { value: "localhost:5173/settings" } });
    fireEvent.submit(addressInput.closest("form")!);

    expect(docBrowserState.navigate).toHaveBeenCalledWith("http://localhost:5173/settings");
  });
});
