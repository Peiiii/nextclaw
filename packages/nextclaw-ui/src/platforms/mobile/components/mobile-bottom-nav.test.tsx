import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/app/components/i18n-provider";
import { MobileBottomNav } from "@/platforms/mobile/components/mobile-bottom-nav";

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
    expect(screen.getByRole("link", { name: /settings/i }).className).not.toContain(
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
});
