import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/components/layout/AppLayout";
import { I18nProvider } from "@/components/providers/I18nProvider";

vi.mock("@/components/layout/Sidebar", () => ({
  Sidebar: () => (
    <aside data-testid="settings-sidebar-header">Settings Sidebar</aside>
  ),
}));

describe("AppLayout", () => {
  it("treats /agents as a main workspace route instead of the settings shell", () => {
    const { container } = render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/agents"]}>
          <Routes>
            <Route
              path="*"
              element={
                <AppLayout>
                  <div data-testid="agents-content">Agents Content</div>
                </AppLayout>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByTestId("agents-content")).toBeTruthy();
    expect(screen.queryByTestId("settings-sidebar-header")).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
  });

  it("keeps settings routes on the shared shell without channel-specific scroll locking", () => {
    const { container } = render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/channels"]}>
          <Routes>
            <Route
              path="*"
              element={
                <AppLayout>
                  <div data-testid="channels-content">Channels Content</div>
                </AppLayout>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    const main = container.querySelector("main");

    expect(screen.getByTestId("channels-content")).toBeTruthy();
    expect(main).toBeTruthy();
    expect(main?.className).toContain("overflow-auto");
    expect(main?.className).not.toContain("xl:overflow-hidden");
  });
});
