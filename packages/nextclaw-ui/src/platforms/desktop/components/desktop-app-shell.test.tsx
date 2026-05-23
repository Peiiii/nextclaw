import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopAppShell } from "@/platforms/desktop/components/desktop-app-shell";

vi.mock("@/app/components/layout/sidebar", () => ({
  Sidebar: () => <aside data-testid="settings-sidebar">Settings Sidebar</aside>,
}));

function setDesktopPlatform(platform: string | null): void {
  window.nextclawDesktop = platform
    ? ({
        platform,
      } as typeof window.nextclawDesktop)
    : undefined;
}

function renderDesktopShell(platform: string | null) {
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
      <DesktopAppShell
        pathname="/chat"
        isDocBrowserOpen={false}
        docBrowserMode="floating"
      >
        <div data-testid="app-content">App Content</div>
      </DesktopAppShell>
    </QueryClientProvider>,
  );
}

describe("DesktopAppShell", () => {
  afterEach(() => {
    setDesktopPlatform(null);
  });

  it("renders the reserved Windows chrome row above app content", () => {
    renderDesktopShell("win32");

    const chrome = screen.getByTestId("desktop-window-chrome");
    const sidebarChrome = screen.getByTestId("desktop-window-chrome-sidebar");
    const resizeStrip = screen.getByTestId("desktop-window-chrome-resize-strip");
    const controls = screen.getByTestId("desktop-window-controls");

    expect(chrome).toBeTruthy();
    expect(chrome.parentElement?.style.getPropertyValue("--desktop-titlebar-height")).toBe("40px");
    expect(chrome.className).toContain("bg-secondary");
    expect(chrome.className).toContain("border-b");
    expect(chrome.className).toContain("desktop-window-drag");
    expect(sidebarChrome.className).toContain("w-[var(--desktop-sidebar-width)]");
    expect(sidebarChrome.className).toContain("desktop-window-no-drag");
    expect(resizeStrip.className).toContain("desktop-window-no-drag");
    expect(resizeStrip.className).toContain("top-0");
    expect(resizeStrip.className).toContain("h-1");
    expect(controls.className).toContain("desktop-window-no-drag");
    expect(screen.getByLabelText("Minimize").className).toContain("desktop-window-no-drag");
    expect(screen.getByLabelText("Maximize").className).toContain("desktop-window-no-drag");
    expect(screen.getByLabelText("Close").className).toContain("desktop-window-no-drag");
    expect(screen.getByTestId("app-content")).toBeTruthy();
  });

  it("keeps non-Windows desktop hosts on the existing shell shape", () => {
    renderDesktopShell("darwin");

    expect(screen.queryByTestId("desktop-window-chrome")).toBeNull();
    expect(screen.getByTestId("app-content")).toBeTruthy();
  });
});
