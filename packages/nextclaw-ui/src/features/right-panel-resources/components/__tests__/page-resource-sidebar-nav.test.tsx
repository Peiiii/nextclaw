import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import { useViewportLayoutStore } from "@/app/stores/viewport-layout.store";
import { PageResourceSidebarNav } from "@/features/right-panel-resources/components/page-resource-sidebar-nav";
import { usePageNavigationStore } from "@/features/right-panel-resources/stores/page-navigation.store";
import { AppPresenterProvider } from "@/app/components/app-presenter-provider";
import type { PanelAppEntryView } from "@/shared/lib/api";
import { SidebarNavLinkItem } from "@/app/components/layout/sidebar-items";

const mocks = vi.hoisted(() => ({
  entries: [] as PanelAppEntryView[],
  mutate: vi.fn(),
}));

vi.mock("@/features/panel-apps/hooks/use-panel-apps", () => ({
  usePanelApps: () => ({ data: { entries: mocks.entries } }),
  useUpdatePanelAppPreferences: () => ({
    isPending: false,
    mutate: mocks.mutate,
  }),
}));

function createEntry(
  overrides: Partial<PanelAppEntryView> = {},
): PanelAppEntryView {
  return {
    appId: "demo",
    clientDeclared: false,
    clientGranted: false,
    contentPath: "/api/panel-apps/demo/content",
    createdAt: "2026-08-19T00:00:00.000Z",
    favorite: false,
    fileName: "demo.panel.html",
    id: "demo",
    kind: "single-file",
    mainSidebar: false,
    openCount: 0,
    sizeBytes: 10,
    title: "Demo",
    updatedAt: "2026-08-19T00:00:00.000Z",
    ...overrides,
  };
}

function renderNav(collapsed = false, route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppPresenterProvider>
        <PageResourceSidebarNav isCollapsed={collapsed} />
      </AppPresenterProvider>
    </MemoryRouter>,
  );
}
describe("shared left pages", () => {
  beforeEach(() => {
    localStorage.clear();
    viewportLayoutManager.resetForTests();
    usePageNavigationStore.setState({ pinned: [] });
    mocks.entries = [];
    mocks.mutate.mockReset();
  });
  it("preserves app ordering and app routes while including arbitrary pinned pages", () => {
    mocks.entries = [
      createEntry({
        appId: "second",
        title: "Second",
        mainSidebar: true,
        mainSidebarOrder: 1,
      }),
      createEntry({
        appId: "first",
        title: "First",
        mainSidebar: true,
        mainSidebarOrder: 0,
      }),
      createEntry({ appId: "hidden", title: "Hidden" }),
    ];
    const uri = "nextclaw://page?path=%2Fskills";
    usePageNavigationStore.setState({
      pinned: [
        {
          uri,
          title: "Skills",
          mainPath: "/skills",
          target: {
            kind: "route",
            title: "Skills",
            url: "/skills",
            resourceUri: uri,
            historyPolicy: "none",
          },
        },
      ],
    });
    renderNav(false, "/apps/panel/first");
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["First", "Second", "Skills"],
    );
    expect(
      screen.getByRole("link", { name: "First" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Skills" }).getAttribute("href"),
    ).toBe("/skills");
    expect(screen.queryByText("Hidden")).toBeNull();
  });
  it("preserves the collapsed group preference", async () => {
    mocks.entries = [createEntry({ mainSidebar: true })];
    renderNav();
    await userEvent.click(screen.getByRole("button", { name: "Pages 1" }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      useViewportLayoutStore.getState().isMainSidebarAppGroupCollapsed,
    ).toBe(true);
  });
  it("uses shared actions without nesting action buttons inside links and keeps app preferences on their existing owner", async () => {
    mocks.entries = [createEntry({ mainSidebar: true })];
    renderNav();
    const link = screen.getByRole("link", { name: "Demo" });
    const menu = screen.getByRole("button", { name: "Page actions" });
    expect(link.contains(menu)).toBe(false);
    expect(menu.querySelector(".lucide-ellipsis-vertical")).not.toBeNull();
    expect(menu.parentElement?.className).toContain(
      "group-hover/sidebar-item:opacity-100",
    );
    expect(menu.parentElement?.className).toContain(
      "group-focus-within/sidebar-item:opacity-100",
    );
    expect(menu.parentElement?.className).toContain(
      "data-[context-menu-open]:opacity-100",
    );
    await userEvent.click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(menu.parentElement?.hasAttribute("data-context-menu-open")).toBe(
      true,
    );
    expect(screen.queryByRole("menuitem", { name: "Unpin from left sidebar" })).toBeNull();
    await userEvent.click(screen.getByRole("menuitem", { name: "Layout and position" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Unpin from left sidebar" }),
    );
    expect(mocks.mutate).toHaveBeenCalledWith({
      id: "demo",
      preferences: { mainSidebar: false },
    });
  });
  it("closes the collapsed rail menu after navigation", async () => {
    mocks.entries = [createEntry({ mainSidebar: true })];
    renderNav(true);
    expect(screen.queryByRole("link")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Pages" }));
    await userEvent.click(screen.getByRole("link", { name: "Demo" }));
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("omits an empty group", () => {
    expect(renderNav().container.firstChild).toBeNull();
  });
  it("shares one whole-row surface with primary navigation and keeps actions inside that surface", () => {
    mocks.entries = [createEntry({ mainSidebar: true })];
    render(
      <MemoryRouter><AppPresenterProvider>
        <SidebarNavLinkItem to="/inbox" label="Inbox" density="compact" />
        <PageResourceSidebarNav isCollapsed={false} />
      </AppPresenterProvider></MemoryRouter>,
    );
    const primary = screen.getByRole("link", { name: "Inbox" });
    const page = screen.getByRole("link", { name: "Demo" });
    expect(page.parentElement?.className).toBe(primary.parentElement?.className);
    expect(page.parentElement?.contains(screen.getByRole("button", { name: "Page actions" }))).toBe(true);
    expect(page.className).toContain("pr-9");
  });
  it("distinguishes resources sharing a pathname by their query identity", () => {
    render(<MemoryRouter initialEntries={["/resource?uri=one"]}>
      <SidebarNavLinkItem to="/resource?uri=one" label="One" />
      <SidebarNavLinkItem to="/resource?uri=two" label="Two" />
    </MemoryRouter>);
    expect(screen.getByRole("link", { name: "One" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Two" }).hasAttribute("aria-current")).toBe(false);
  });
});
