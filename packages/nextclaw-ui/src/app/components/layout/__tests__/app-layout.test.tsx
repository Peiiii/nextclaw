import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/app/components/layout/app-layout";
import { I18nProvider } from "@/app/components/i18n-provider";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import { useSideDockStore } from "@/features/side-dock";

const { useViewportLayoutMock } = vi.hoisted(() => ({
  useViewportLayoutMock: vi.fn(() => ({
    mode: "desktop" as "mobile" | "desktop",
    isMobile: false,
    isDesktop: true,
  })),
}));

vi.mock("@/app/hooks/use-viewport-layout", () => ({
  useViewportLayout: useViewportLayoutMock,
}));

vi.mock("@/app/components/layout/sidebar", () => ({
  Sidebar: () => (
    <aside data-testid="settings-sidebar-header">Settings Sidebar</aside>
  ),
}));

vi.mock("@/platforms/mobile", () => ({
  MobileBottomNav: () => <nav data-testid="mobile-bottom-nav" />,
  MobileAppShell: ({
    children,
    topbarLeadingInset,
  }: {
    children: ReactNode;
    topbarLeadingInset?: string;
  }) => (
    <div
      data-testid="mobile-app-shell"
      data-topbar-leading-inset={topbarLeadingInset ?? ""}
    >
      {children}
    </div>
  ),
}));

describe("AppLayout", () => {
  beforeEach(() => {
    window.localStorage.clear();
    viewportLayoutManager.resetForTests();
    useViewportLayoutMock.mockReturnValue({
      mode: "desktop",
      isMobile: false,
      isDesktop: true,
    });
    window.nextclawDesktop = undefined;
    useSideDockStore.getState().setVisible(true);
    useSideDockStore.getState().setPinnedItems([]);
  });

  it("treats /agents as a main workspace route instead of the settings shell", () => {
    const { container } = render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/agents"]}>
          <Routes>
            <Route
              path="*"
              element={
                <AppLayout>
                  <div data-testid="agents-content">Agents Content</div>
                </AppLayout>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByTestId("agents-content")).toBeTruthy();
    expect(screen.queryByTestId("settings-sidebar-header")).toBeNull();
    expect(container.querySelector("main")).toBeNull();
    expect(screen.getByTestId("side-dock")).toBeTruthy();
  });

  it("hides the side dock when the persisted visibility preference is off", () => {
    useSideDockStore.getState().setVisible(false);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/chat"]}>
          <Routes>
            <Route
              path="*"
              element={
                <AppLayout>
                  <div data-testid="chat-content">Chat Content</div>
                </AppLayout>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByTestId("chat-content")).toBeTruthy();
    expect(screen.queryByTestId("side-dock")).toBeNull();
  });

  it("keeps settings routes on the shared shell without channel-specific scroll locking", () => {
    const { container } = render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/channels"]}>
          <Routes>
            <Route
              path="*"
              element={
                <AppLayout>
                  <div data-testid="channels-content">Channels Content</div>
                </AppLayout>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    const main = container.querySelector("main");

    expect(screen.getByTestId("channels-content")).toBeTruthy();
    expect(main).toBeTruthy();
    expect(main?.className).toContain("overflow-auto");
    expect(main?.className).not.toContain("xl:overflow-hidden");
  });

  it("switches to the mobile shell when the viewport layout is mobile", () => {
    useViewportLayoutMock.mockReturnValue({
      mode: "mobile",
      isMobile: true,
      isDesktop: false,
    });

    const { container } = render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/chat"]}>
          <Routes>
            <Route
              path="*"
              element={
                <AppLayout>
                  <div data-testid="chat-content">Chat Content</div>
                </AppLayout>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByTestId("chat-content")).toBeTruthy();
    expect(screen.getByTestId("mobile-app-shell")).toBeTruthy();
    expect(screen.queryByTestId("settings-sidebar-header")).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
  });

  it("keeps the desktop shell and mobile navigation on desktop hosts at narrow widths", () => {
    window.nextclawDesktop = {
      platform: "win32",
    } as typeof window.nextclawDesktop;
    useViewportLayoutMock.mockReturnValue({
      mode: "mobile",
      isMobile: true,
      isDesktop: false,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <MemoryRouter initialEntries={["/chat"]}>
            <Routes>
              <Route
                path="*"
                element={
                  <AppLayout>
                    <div data-testid="chat-content">Chat Content</div>
                  </AppLayout>
                }
              />
            </Routes>
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("chat-content")).toBeTruthy();
    expect(screen.getByTestId("desktop-window-chrome")).toBeTruthy();
    expect(
      screen.getByTestId("desktop-window-chrome-sidebar").className,
    ).toContain("desktop-window-drag");
    expect(screen.getByTestId("mobile-bottom-nav")).toBeTruthy();
  });

  it("uses the mobile shell with a macOS traffic-light inset on narrow macOS desktop hosts", () => {
    window.nextclawDesktop = {
      platform: "darwin",
    } as typeof window.nextclawDesktop;
    useViewportLayoutMock.mockReturnValue({
      mode: "mobile",
      isMobile: true,
      isDesktop: false,
    });

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/chat"]}>
          <Routes>
            <Route
              path="*"
              element={
                <AppLayout>
                  <div data-testid="chat-content">Chat Content</div>
                </AppLayout>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByTestId("chat-content")).toBeTruthy();
    expect(
      screen
        .getByTestId("mobile-app-shell")
        .getAttribute("data-topbar-leading-inset"),
    ).toBe("4.75rem");
    expect(screen.queryByTestId("desktop-window-chrome")).toBeNull();
  });
});
