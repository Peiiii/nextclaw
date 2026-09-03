import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelAppOpenStandaloneMenuItem } from "@/features/panel-apps/components/panel-app-open-standalone-menu-item";
import type { PanelAppEntryView } from "@/shared/lib/api";

const entry: PanelAppEntryView = {
  appId: "publisher.todo board",
  clientDeclared: false,
  clientGranted: false,
  contentPath: "/api/panel-apps/publisher.todo%20board/content",
  createdAt: "2026-09-03T00:00:00.000Z",
  favorite: false,
  fileName: "todo.panel.html",
  id: "todo",
  kind: "single-file",
  mainSidebar: false,
  openCount: 0,
  sizeBytes: 10,
  title: "Todo",
  updatedAt: "2026-09-03T00:00:00.000Z",
};

function setDesktopHost(value: Window["nextclawDesktop"] | undefined) {
  Object.defineProperty(window, "nextclawDesktop", {
    configurable: true,
    value,
  });
}

describe("PanelAppOpenStandaloneMenuItem", () => {
  afterEach(() => {
    setDesktopHost(undefined);
  });

  it("uses a real new-tab link on the web", () => {
    const onSelect = vi.fn();
    setDesktopHost(undefined);
    render(
      <PanelAppOpenStandaloneMenuItem entry={entry} onSelect={onSelect} />,
    );

    const link = screen.getByRole("link", { name: "Open in New Tab" });
    expect(link.getAttribute("href")).toBe(
      "/apps/panel/publisher.todo%20board/standalone",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("describes the same link as opening in the browser inside Desktop", () => {
    setDesktopHost({ platform: "darwin" } as Window["nextclawDesktop"]);
    render(<PanelAppOpenStandaloneMenuItem entry={entry} />);

    expect(screen.getByRole("link", { name: "Open in Browser" })).toBeTruthy();
  });
});
