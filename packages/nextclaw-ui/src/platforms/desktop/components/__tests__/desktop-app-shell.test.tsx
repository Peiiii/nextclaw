import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopAppShell } from "@/platforms/desktop/components/desktop-app-shell";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";

vi.mock("@/app/components/layout/sidebar", () => ({
  Sidebar: () => <aside data-testid="settings-sidebar">Settings Sidebar</aside>,
}));

vi.mock("@/platforms/mobile", () => ({
  MobileBottomNav: () => <nav data-testid="mobile-bottom-nav" />,
}));

type WindowStateListener = (snapshot: { isMaximized: boolean }) => void;

let windowStateListener: WindowStateListener | null = null;

function setDesktopPlatform(
  platform: string | null,
  isMaximized = false,
): void {
  windowStateListener = null;
  window.nextclawDesktop = platform
    ? ({
        platform,
        getWindowState: async () => ({ isMaximized }),
        onWindowStateChanged: (listener: WindowStateListener) => {
          windowStateListener = listener;
          return () => {
            windowStateListener = null;
          };
        },
      } as typeof window.nextclawDesktop)
    : undefined;
}

function renderDesktopShell(platform: string | null, isMobileLayout = false) {
  setDesktopPlatform(platform);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/chat"]}>
        <DesktopAppShell
          pathname="/chat"
          isMobileLayout={isMobileLayout}
          isDocBrowserOpen={false}
          docBrowserMode="floating"
        >
          <div data-testid="app-content">App Content</div>
        </DesktopAppShell>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DesktopAppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    viewportLayoutManager.resetForTests();
  });

  afterEach(() => {
    setDesktopPlatform(null);
  });

  it("renders the reserved Windows chrome row above app content", () => {
    renderDesktopShell("win32");

    const chrome = screen.getByTestId("desktop-window-chrome");
    const sidebarChrome = screen.getByTestId("desktop-window-chrome-sidebar");
    const resizeStrip = screen.getByTestId(
      "desktop-window-chrome-resize-strip",
    );
    const controls = screen.getByTestId("desktop-window-controls");

    expect(chrome).toBeTruthy();
    expect(
      chrome.parentElement?.style.getPropertyValue("--desktop-titlebar-height"),
    ).toBe("40px");
    expect(chrome.className).toContain("bg-secondary");
    expect(chrome.className).not.toContain(" shrink-0 border-b ");
    expect(chrome.className).toContain(
      "after:left-[var(--desktop-sidebar-width)]",
    );
    expect(chrome.className).toContain("after:border-b");
    expect(chrome.className).toContain("desktop-window-drag");
    expect(sidebarChrome.className).toContain(
      "w-[var(--desktop-sidebar-width)]",
    );
    expect(sidebarChrome.className).not.toContain("border-b");
    expect(sidebarChrome.className).toContain("desktop-window-drag");
    expect(resizeStrip.className).toContain("desktop-window-no-drag");
    expect(resizeStrip.className).toContain("top-0");
    expect(resizeStrip.className).toContain("h-1");
    expect(controls.className).toContain("desktop-window-no-drag");
    expect(screen.getByLabelText("Minimize").className).toContain(
      "desktop-window-no-drag",
    );
    expect(screen.getByLabelText("Maximize").className).toContain(
      "desktop-window-no-drag",
    );
    expect(screen.getByLabelText("Close").className).toContain(
      "desktop-window-no-drag",
    );
    expect(screen.getByTestId("app-content")).toBeTruthy();
  });

  it("uses the collapsed sidebar width in Windows chrome from the shared layout store", () => {
    viewportLayoutManager.setSidebarCollapsed(true);

    renderDesktopShell("win32");

    const chromeRoot = screen.getByTestId(
      "desktop-window-chrome",
    ).parentElement;

    expect(chromeRoot?.style.getPropertyValue("--desktop-sidebar-width")).toBe(
      "56px",
    );
    expect(screen.getByAltText("NextClaw")).toBeTruthy();
  });

  it("switches the Windows maximize button to restore while maximized", async () => {
    renderDesktopShell("win32");

    expect(await screen.findByLabelText("Maximize")).toBeTruthy();

    act(() => {
      windowStateListener?.({ isMaximized: true });
    });

    expect(screen.getByLabelText("Restore").className).toContain(
      "desktop-window-no-drag",
    );
    expect(screen.queryByLabelText("Maximize")).toBeNull();
  });

  it("keeps non-Windows desktop hosts on the existing shell shape", () => {
    renderDesktopShell("darwin");

    expect(screen.queryByTestId("desktop-window-chrome")).toBeNull();
    expect(screen.getByTestId("app-content")).toBeTruthy();
  });

  it("keeps mobile bottom navigation visible inside Windows desktop hosts at narrow widths", () => {
    renderDesktopShell("win32", true);

    expect(screen.getByTestId("desktop-window-chrome")).toBeTruthy();
    expect(screen.getByTestId("mobile-bottom-nav")).toBeTruthy();
    expect(screen.getByTestId("app-content")).toBeTruthy();
  });
});
