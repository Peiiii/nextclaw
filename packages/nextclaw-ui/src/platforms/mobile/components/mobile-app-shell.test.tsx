import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/app/components/i18n-provider";
import { MobileAppShell } from "@/platforms/mobile/components/mobile-app-shell";

function renderShell(pathname: string) {
  const view = render(
    <I18nProvider>
      <MemoryRouter initialEntries={[pathname]}>
        <MobileAppShell pathname={pathname} isDocBrowserOpen={false}>
          <div>Content</div>
        </MobileAppShell>
      </MemoryRouter>
    </I18nProvider>,
  );
  return {
    ...view,
    shell: view.container.firstElementChild as HTMLElement,
  };
}

describe("MobileAppShell", () => {
  it("shows the bottom navigation on the chat list route", () => {
    const { shell } = renderShell("/chat");

    expect(shell.className).toContain("h-[100svh]");
    expect(shell.className).toContain("supports-[height:100dvh]:h-[100dvh]");
    expect(shell.className).not.toContain("h-screen");
    expect(screen.getByTestId("mobile-bottom-nav")).toBeTruthy();
  });

  it("centers primary route titles without reserving back-button spacers", () => {
    renderShell("/skills");

    const topbar = screen.getByTestId("mobile-topbar");
    const heading = screen.getByRole("heading", { name: "Skills" });

    expect(heading.className).toContain("text-center");
    expect(topbar.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("hides the shared mobile chrome on chat session detail routes", () => {
    renderShell("/chat/demo-session");

    expect(screen.queryByTestId("mobile-bottom-nav")).toBeNull();
    expect(screen.queryByTestId("mobile-topbar")).toBeNull();
  });
});
