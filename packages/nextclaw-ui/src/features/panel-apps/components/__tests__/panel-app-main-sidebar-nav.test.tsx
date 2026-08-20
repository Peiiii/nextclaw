import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import { useViewportLayoutStore } from "@/app/stores/viewport-layout.store";
import {
  getMainSidebarPanelApps,
  PanelAppMainSidebarNav,
} from "@/features/panel-apps/components/panel-app-main-sidebar-nav";
import type { PanelAppEntryView } from "@/shared/lib/api";

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

describe("PanelAppMainSidebarNav", () => {
  beforeEach(() => {
    window.localStorage.clear();
    viewportLayoutManager.resetForTests();
    mocks.entries = [];
    mocks.mutate.mockReset();
  });

  it("projects only manually added apps in persisted order", () => {
    const entries = [
      createEntry({ appId: "hidden", title: "Hidden" }),
      createEntry({
        appId: "second",
        mainSidebar: true,
        mainSidebarOrder: 1,
        title: "Second",
      }),
      createEntry({
        appId: "first",
        mainSidebar: true,
        mainSidebarOrder: 0,
        title: "First",
      }),
    ];

    expect(
      getMainSidebarPanelApps(entries).map((entry) => entry.appId),
    ).toEqual(["first", "second"]);
  });

  it("renders stable app routes and hides unbound apps", () => {
    mocks.entries = [
      createEntry({
        appId: "publisher.todo",
        mainSidebar: true,
        title: "Todo",
      }),
      createEntry({ appId: "hidden", title: "Hidden" }),
    ];

    render(
      <MemoryRouter initialEntries={["/apps/panel/publisher.todo"]}>
        <PanelAppMainSidebarNav isCollapsed={false} />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Todo" });
    expect(link.getAttribute("href")).toBe("/apps/panel/publisher.todo");
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(screen.queryByText("Hidden")).toBeNull();
    const groupButton = screen.getByRole("button", { name: "Collapse apps" });
    expect(groupButton.getAttribute("aria-expanded")).toBe("true");
    expect(groupButton.className).toContain("text-[13px]");
    expect(groupButton.className).toContain("font-medium");
    expect(groupButton.className).not.toContain("text-[11px]");
  });

  it("collapses the ordered app group and persists the device layout preference", async () => {
    const user = userEvent.setup();
    mocks.entries = [
      createEntry({
        appId: "first",
        mainSidebar: true,
        mainSidebarOrder: 0,
        title: "First",
      }),
      createEntry({
        appId: "second",
        mainSidebar: true,
        mainSidebarOrder: 1,
        title: "Second",
      }),
    ];

    render(
      <MemoryRouter>
        <PanelAppMainSidebarNav isCollapsed={false} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Collapse apps" }));

    expect(screen.queryByRole("link", { name: "First" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Second" })).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Expand apps" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      useViewportLayoutStore.getState().isMainSidebarAppGroupCollapsed,
    ).toBe(true);
    const persisted = JSON.parse(
      window.localStorage.getItem("nextclaw.app.viewport-layout") ?? "{}",
    ) as { state?: { isMainSidebarAppGroupCollapsed?: boolean } };
    expect(persisted.state?.isMainSidebarAppGroupCollapsed).toBe(true);
  });

  it("removes an expanded entry from its hover actions without nesting the button in the link", async () => {
    const user = userEvent.setup();
    mocks.entries = [
      createEntry({
        appId: "publisher.todo",
        mainSidebar: true,
        title: "Todo",
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/apps/panel/publisher.todo"]}>
        <PanelAppMainSidebarNav isCollapsed={false} />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Todo" });
    const menuButton = screen.getByRole("button", {
      name: "More panel app actions: Todo",
    });
    expect(link.contains(menuButton)).toBe(false);
    expect(menuButton.className).toContain("group-hover/panel-app:opacity-100");

    await user.click(menuButton);
    await user.click(
      screen.getByRole("button", { name: "Remove from main sidebar" }),
    );

    expect(mocks.mutate).toHaveBeenCalledWith({
      id: "demo",
      preferences: { mainSidebar: false },
    });
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("aggregates collapsed-rail apps behind one navigation menu", async () => {
    const user = userEvent.setup();
    mocks.entries = [
      createEntry({
        appId: "publisher.todo",
        mainSidebar: true,
        title: "Todo",
      }),
      createEntry({
        appId: "publisher.notes",
        mainSidebar: true,
        title: "Notes",
      }),
    ];

    render(
      <MemoryRouter>
        <PanelAppMainSidebarNav isCollapsed />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Todo" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "More panel app actions: Todo" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Apps" }));
    expect(screen.getByRole("link", { name: "Todo" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Notes" })).toBeTruthy();
  });

  it("renders no section when no app was manually added", () => {
    const { container } = render(
      <MemoryRouter>
        <PanelAppMainSidebarNav isCollapsed={false} />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });
});
