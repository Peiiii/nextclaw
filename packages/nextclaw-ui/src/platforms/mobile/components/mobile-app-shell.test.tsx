import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/app/components/i18n-provider";
import { MobileAppShell } from "@/platforms/mobile/components/mobile-app-shell";

function renderShell(pathname: string) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[pathname]}>
        <MobileAppShell pathname={pathname} isDocBrowserOpen={false}>
          <div>Content</div>
        </MobileAppShell>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("MobileAppShell", () => {
  it("shows the bottom navigation on the chat list route", () => {
    renderShell("/chat");

    expect(screen.getByTestId("mobile-bottom-nav")).toBeTruthy();
  });

  it("does not reserve back-button spacer on primary mobile routes", () => {
    renderShell("/skills");

    const topbar = screen.getByTestId("mobile-topbar");

    expect(screen.getByRole("heading", { name: "Skills" })).toBeTruthy();
    expect(topbar.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("hides the shared mobile chrome on chat session detail routes", () => {
    renderShell("/chat/demo-session");

    expect(screen.queryByTestId("mobile-bottom-nav")).toBeNull();
    expect(screen.queryByTestId("mobile-topbar")).toBeNull();
  });
});
