import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/app/components/i18n-provider";
import { MobileBottomNav } from "@/platforms/mobile/components/mobile-bottom-nav";

const { openAppsMock } = vi.hoisted(() => ({ openAppsMock: vi.fn() }));

vi.mock("@/features/panel-apps", () => ({ openApps: openAppsMock }));
vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({ open: vi.fn() }),
}));

describe("MobileBottomNav", () => {
  it("highlights the settings tab for nested settings routes", () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/providers"]}>
          <MobileBottomNav />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(
      screen.getByRole("link", { name: /settings/i }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: /chat/i }).getAttribute("aria-current"),
    ).toBeNull();
    expect(screen.getByTestId("mobile-nav-active-indicator")).toBeTruthy();
    expect(screen.getByRole("link", { name: /settings/i }).className).toContain(
      "bg-gray-100",
    );
    expect(screen.getByTestId("mobile-nav-active-indicator").textContent).toMatch(
      /settings/i,
    );
  });

  it("highlights the chat tab for chat routes", () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/chat/demo-session"]}>
          <MobileBottomNav />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(
      screen.getByRole("link", { name: /chat/i }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("opens the apps panel from the mobile navigation", () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/chat"]}>
          <MobileBottomNav />
        </MemoryRouter>
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Apps" }));

    expect(openAppsMock).toHaveBeenCalledOnce();
  });
});
