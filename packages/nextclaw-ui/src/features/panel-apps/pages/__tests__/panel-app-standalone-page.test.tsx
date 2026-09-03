import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelAppStandalonePage } from "@/features/panel-apps/pages/panel-app-standalone-page";
import type { PanelAppEntryView } from "@/shared/lib/api";

const entry: PanelAppEntryView = {
  appId: "publisher.todo",
  clientDeclared: false,
  clientGranted: false,
  contentPath: "/api/panel-apps/publisher.todo/content",
  createdAt: "2026-09-03T00:00:00.000Z",
  favorite: false,
  fileName: "todo.panel.html",
  id: "todo",
  kind: "single-file",
  mainSidebar: false,
  openCount: 0,
  sizeBytes: 10,
  title: "Rust Todo",
  updatedAt: "2026-09-03T00:00:00.000Z",
};

vi.mock("@/features/panel-apps/hooks/use-panel-apps", () => ({
  usePanelApp: () => ({
    data: entry,
  }),
}));

vi.mock("@/features/panel-apps/components/panel-app-runtime-surface", () => ({
  PanelAppRuntimeSurface: ({
    appId,
    restorationScope,
  }: {
    appId: string;
    restorationScope: string;
  }) => (
    <div
      data-testid="panel-app-runtime-surface"
      data-app-id={appId}
      data-restoration-scope={restorationScope}
    />
  ),
}));

describe("PanelAppStandalonePage", () => {
  const originalTitle = document.title;

  afterEach(() => {
    document.title = originalTitle;
  });

  it("renders only the standalone runtime surface and sets the tab title", () => {
    const { container } = render(
      <PanelAppStandalonePage appId="publisher.todo" />,
    );

    const surface = screen.getByTestId("panel-app-runtime-surface");
    expect(surface.getAttribute("data-app-id")).toBe("publisher.todo");
    expect(surface.getAttribute("data-restoration-scope")).toBe("standalone");
    expect(document.title).toBe("Rust Todo · NextClaw");
    expect(container.querySelector("main")?.children).toHaveLength(1);
  });
});
