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

describe("SettingsEntryPage", () => {
  it("redirects desktop users to the model settings page", () => {
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

    useViewportLayoutMock.mockReturnValue({
      mode: "desktop",
      isMobile: false,
      isDesktop: true,
    });
  });
});
