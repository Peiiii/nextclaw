import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMainSidebarPanelApps,
  PanelAppMainSidebarNav,
} from "@/features/panel-apps/components/panel-app-main-sidebar-nav";
import type { PanelAppEntryView } from "@/shared/lib/api";

const mocks = vi.hoisted(() => ({
  entries: [] as PanelAppEntryView[],
}));

vi.mock("@/features/panel-apps/hooks/use-panel-apps", () => ({
  usePanelApps: () => ({ data: { entries: mocks.entries } }),
}));

function createEntry(overrides: Partial<PanelAppEntryView> = {}): PanelAppEntryView {
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
    mocks.entries = [];
  });

  it("projects only manually added apps in persisted order", () => {
    const entries = [
      createEntry({ appId: "hidden", title: "Hidden" }),
      createEntry({ appId: "second", mainSidebar: true, mainSidebarOrder: 1, title: "Second" }),
      createEntry({ appId: "first", mainSidebar: true, mainSidebarOrder: 0, title: "First" }),
    ];

    expect(getMainSidebarPanelApps(entries).map((entry) => entry.appId)).toEqual([
      "first",
      "second",
    ]);
  });

  it("renders stable app routes and hides unbound apps", () => {
    mocks.entries = [
      createEntry({ appId: "publisher.todo", mainSidebar: true, title: "Todo" }),
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
