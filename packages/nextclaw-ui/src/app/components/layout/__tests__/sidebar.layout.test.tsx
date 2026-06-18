import { render, screen, within } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/app/components/layout/sidebar";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import type * as RemoteFeature from "@/features/remote";

const mocks = vi.hoisted(() => ({
  openAccountPanel: vi.fn(),
  docOpen: vi.fn(),
  remoteStatus: {
    data: {
      account: {
        loggedIn: true,
        email: "user@example.com",
      },
    },
  },
}));

vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({
    open: mocks.docOpen,
  }),
}));

vi.mock("@/app/components/app-presenter-provider", () => ({
  useAppPresenter: () => ({
    accountManager: {
      openAccountPanel: mocks.openAccountPanel,
    },
  }),
}));

vi.mock("@/features/remote", async () => {
  const actual =
    await vi.importActual<typeof RemoteFeature>("@/features/remote");
  return {
    ...actual,
    useRemoteStatus: () => mocks.remoteStatus,
  };
});

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({
    language: "en",
    setLanguage: vi.fn(),
  }),
}));

vi.mock("@/app/components/theme-provider", () => ({
  useTheme: () => ({
    theme: "warm",
    setTheme: vi.fn(),
  }),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    viewportLayoutManager.resetForTests();
  });

  it("keeps the settings sidebar bounded and lets the navigation scroll independently", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/model"]}>
        <Sidebar mode="settings" />
      </MemoryRouter>,
    );

    const aside = container.querySelector("aside");
    const nav = container.querySelector("nav");

    expect(aside?.className).toContain("min-h-0");
    expect(aside?.className).toContain("overflow-hidden");
    expect(
      screen.getByTestId("settings-sidebar-header").parentElement?.className,
    ).toMatch(/(?:^|\s)py-2(?:\s|$)/);
    expect(aside?.className).not.toContain("py-6");
    expect(nav?.className).toContain("flex-1");
    expect(nav?.className).toContain("min-h-0");
    expect(nav?.className).toContain("overflow-y-auto");
    expect(
      screen.getByRole("link", { current: "page" }).className,
    ).not.toContain("font-semibold");
  });

  it("keeps the original compact single-row header in settings mode", () => {
    render(
      <MemoryRouter initialEntries={["/model"]}>
        <Sidebar mode="settings" />
      </MemoryRouter>,
    );

    const header = screen.getByTestId("settings-sidebar-header");
    const backLink = screen.getByRole("link", { name: "Back to Main" });

    expect(header).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(backLink).toBeTruthy();
    expect(header.className).not.toContain("bg-white");
    expect(header.className).not.toContain("rounded-2xl");
    expect(backLink.className).toContain("hover:bg-gray-200/60");
  });

  it("keeps the settings navigation in the expected product order", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/model"]}>
        <Sidebar mode="settings" />
      </MemoryRouter>,
    );

    const nav = container.querySelector("nav");
    if (!(nav instanceof HTMLElement)) {
      throw new Error("settings nav not found");
    }

    const linkTexts = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent?.trim() || "");

    expect(linkTexts).toEqual([
      "Model",
      "Providers",
      "Channels",
      "Search Channels",
      "Routing & Runtime",
      "Updates",
      "Remote Access",
      "Security",
      "Secrets",
      "MCP",
    ]);
  });

  it("keeps the footer utilities compact without changing the top header structure", () => {
    render(
      <MemoryRouter initialEntries={["/model"]}>
        <Sidebar mode="settings" />
      </MemoryRouter>,
    );

    const accountEntry = screen.getByTestId("settings-sidebar-account-entry");
    const accountStatus = screen.getByTestId("settings-sidebar-account-status");

    expect(accountEntry).toBeTruthy();
    expect(accountEntry.textContent).toContain("Account");
    expect(screen.getByText("user@example.com")).toBeTruthy();
    expect(accountEntry.className).toContain("py-2");
    expect(accountEntry.className).toContain("text-gray-600");
    expect(accountEntry.className).toContain("hover:bg-gray-200/60");
    expect(accountStatus.className).toContain("text-[11px]");
  });

  it("persists the shared sidebar collapsed state through the viewport layout store", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/model"]}>
        <Sidebar mode="settings" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    const aside = container.querySelector("aside");
    const persistedState = JSON.parse(
      window.localStorage.getItem("nextclaw.app.viewport-layout") ?? "{}",
    ) as { state?: { isSidebarCollapsed?: boolean } };

    expect(aside?.getAttribute("data-sidebar-collapsed")).toBe("true");
    expect(persistedState.state?.isSidebarCollapsed).toBe(true);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
  });
});
