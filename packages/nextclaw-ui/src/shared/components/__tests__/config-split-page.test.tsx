import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfigSplitDetailPane,
  ConfigSplitPage,
  ConfigSplitSidebar,
} from "@/shared/components/config-split-page";
import { I18nProvider } from "@/app/components/i18n-provider";

describe("ConfigSplitPage", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 500 });
    vi.stubGlobal("ResizeObserver", class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe = () => this.callback([], this as unknown as ResizeObserver);
      disconnect = () => {};
      unobserve = () => {};
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows only the list pane in mobile list mode", () => {
    render(
      <I18nProvider>
        <ConfigSplitPage compactView="list" mobileListLabel="Providers">
          <ConfigSplitSidebar>
            <div data-testid="config-list-pane">List Pane</div>
          </ConfigSplitSidebar>
          <ConfigSplitDetailPane>
            <div data-testid="config-detail-pane">Detail Pane</div>
          </ConfigSplitDetailPane>
        </ConfigSplitPage>
      </I18nProvider>,
    );

    expect(screen.getByTestId("config-list-pane")).toBeTruthy();
    expect(screen.queryByTestId("config-detail-pane")).toBeNull();
  });

  it("shows the detail pane and back affordance in mobile detail mode", () => {
    render(
      <I18nProvider>
        <ConfigSplitPage compactView="detail" mobileListLabel="Providers">
          <ConfigSplitSidebar>
            <div data-testid="config-list-pane">List Pane</div>
          </ConfigSplitSidebar>
          <ConfigSplitDetailPane>
            <div data-testid="config-detail-pane">Detail Pane</div>
          </ConfigSplitDetailPane>
        </ConfigSplitPage>
      </I18nProvider>,
    );

    expect(screen.queryByTestId("config-list-pane")).toBeNull();
    expect(screen.getByTestId("config-detail-pane")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Providers" })).toBeTruthy();
  });
});
