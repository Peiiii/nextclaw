import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/app/components/i18n-provider";
import { MobileBottomNav } from "@/platforms/mobile/components/mobile-bottom-nav";

const { openAppsMock } = vi.hoisted(() => ({ openAppsMock: vi.fn() }));

vi.mock("@/features/panel-apps", () => ({ openApps: openAppsMock }));
vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({ open: vi.fn() }),
}));

function renderBottomNav(pathname: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[pathname]}>
          <MobileBottomNav />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("MobileBottomNav", () => {
  it("highlights the settings tab for nested settings routes", () => {
    renderBottomNav("/providers");

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
    renderBottomNav("/chat/demo-session");

    expect(
      screen.getByRole("link", { name: /chat/i }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("opens the apps panel from the mobile navigation", () => {
    renderBottomNav("/chat");

    fireEvent.click(screen.getByRole("button", { name: "Apps" }));

    expect(openAppsMock).toHaveBeenCalledOnce();
  });
});
