import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ConfigSplitDetailPane,
  ConfigSplitPage,
  ConfigSplitSidebar,
} from "@/shared/components/config-split-page";
import { I18nProvider } from "@/app/components/i18n-provider";

describe("ConfigSplitPage", () => {
  it("shows only the list pane in mobile list mode", () => {
    render(
      <I18nProvider>
        <ConfigSplitPage mobileView="list" mobileListLabel="Providers">
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
        <ConfigSplitPage mobileView="detail" mobileListLabel="Providers">
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
