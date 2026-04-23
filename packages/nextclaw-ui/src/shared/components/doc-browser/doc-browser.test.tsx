import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocBrowser } from "@/shared/components/doc-browser/doc-browser";

const { docBrowserState } = vi.hoisted(() => ({
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
    currentTab: {
      id: "docs",
      kind: "docs" as const,
      title: "Docs",
      currentUrl: "https://docs.nextclaw.io/en/guide/getting-started",
      history: ["https://docs.nextclaw.io/en/guide/getting-started"],
      historyIndex: 0,
      navVersion: 0,
    },
    currentUrl: "https://docs.nextclaw.io/en/guide/getting-started",
    navVersion: 0,
    close: vi.fn(),
    toggleMode: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    canGoBack: false,
    canGoForward: false,
    navigate: vi.fn(),
    syncUrl: vi.fn(),
    setActiveTab: vi.fn(),
    closeTab: vi.fn(),
    openNewTab: vi.fn(),
  },
}));

vi.mock("@/shared/components/doc-browser/doc-browser-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/components/doc-browser/doc-browser-context")
  >("@/shared/components/doc-browser/doc-browser-context");

  return {
    ...actual,
    useDocBrowser: () => docBrowserState,
  };
});

describe("DocBrowser", () => {
  it("uses a full viewport panel without desktop resize controls in fullscreen mode", () => {
    render(<DocBrowser displayMode="fullscreen" />);

    const panel = screen.getByTestId("doc-browser-panel");

    expect(panel.className).toContain("fixed");
    expect(panel.className).toContain("inset-0");
    expect(panel.className).toContain("w-screen");
    expect(
      screen.queryByTitle(/float/i) ?? screen.queryByTitle(/dock/i),
    ).toBeNull();
    expect(panel.querySelector(".cursor-ew-resize")).toBeNull();
    expect(panel.querySelector(".cursor-se-resize")).toBeNull();
  });
});
