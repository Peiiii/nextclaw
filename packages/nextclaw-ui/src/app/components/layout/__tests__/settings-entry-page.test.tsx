import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/app/components/i18n-provider";
import { SettingsEntryPage } from "@/app/components/layout/settings-entry-page";

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

vi.mock("@/platforms/mobile", async () => ({
  MobileSettingsShell: (
    await import("@/platforms/mobile/components/mobile-settings-shell")
  ).MobileSettingsShell,
}));

describe("SettingsEntryPage", () => {
  it("redirects desktop users to the primary model settings page", () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route path="/settings" element={<SettingsEntryPage />} />
            <Route
              path="/model"
              element={<div data-testid="model-settings-page">Model</div>}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByTestId("model-settings-page")).toBeTruthy();
  });

  it("renders the mobile settings shell on mobile devices", () => {
    useViewportLayoutMock.mockReturnValue({
      mode: "mobile",
      isMobile: true,
      isDesktop: false,
    });

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route path="/settings" element={<SettingsEntryPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByTestId("mobile-settings-shell")).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.slice(0, 6).map((link) => link.textContent?.trim())).toEqual([
      "Model",
      "Providers",
      "Channels",
      "Search Channels",
      "Appearance",
      "Security",
    ]);
    expect(links.some((link) => link.getAttribute("href") === "/language")).toBe(
      false,
    );
    expect(links.some((link) => link.getAttribute("href") === "/cron")).toBe(
      false,
    );

    useViewportLayoutMock.mockReturnValue({
      mode: "desktop",
      isMobile: false,
      isDesktop: true,
    });
  });
});
