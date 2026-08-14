import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocBrowserTabStrip } from "@/shared/components/doc-browser/doc-browser-tab-strip";
import type { DocBrowserTab } from "@/shared/components/doc-browser/doc-browser-context";

const docsTab: DocBrowserTab = {
  id: "docs",
  kind: "docs",
  title: "Docs",
  currentUrl: "nextclaw://docs",
  history: ["nextclaw://docs"],
  historyIndex: 0,
  navVersion: 0,
};

function renderTabStrip(tabs: DocBrowserTab[]) {
  return render(
    <DocBrowserTabStrip
      tabs={tabs}
      activeTabId={tabs[0]?.id ?? ""}
      canGoBack={false}
      canGoForward={false}
      isDocked={true}
      isFullscreen={false}
      onGoBack={vi.fn()}
      onGoForward={vi.fn()}
      onOpenNewTab={vi.fn()}
      onSetActiveTab={vi.fn()}
      onCloseTab={vi.fn()}
      onClose={vi.fn()}
      onDragStart={vi.fn()}
      onToggleMode={vi.fn()}
    />,
  );
}

describe("DocBrowserTabStrip", () => {
  it("keeps content-sized tabs and renders each tab's own icon", () => {
    renderTabStrip([
      docsTab,
      {
        ...docsTab,
        id: "marketplace",
        kind: "content",
        title: "Marketplace",
        currentUrl: "nextclaw://marketplace",
        dockIcon: { type: "url", url: "/marketplace-icon.png" },
      },
    ]);

    expect(
      screen.getByRole("button", { name: "Docs" })
        .querySelector(".lucide-book-open"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Marketplace" })
        .querySelector('img[src="/marketplace-icon.png"]'),
    ).toBeTruthy();

    const marketplaceTab = screen.getByRole("button", { name: "Marketplace" })
      .closest("[data-compact-tab-item]");
    expect(marketplaceTab?.className).toContain("max-w-[220px]");
    expect(marketplaceTab?.className).not.toContain("min-w-[");

    fireEvent.error(
      screen.getByRole("button", { name: "Marketplace" })
        .querySelector('img[src="/marketplace-icon.png"]')!,
    );
    expect(
      screen.getByRole("button", { name: "Marketplace" })
        .querySelector(".lucide-app-window"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Marketplace" })
        .querySelector("img"),
    ).toBeNull();
  });
});
