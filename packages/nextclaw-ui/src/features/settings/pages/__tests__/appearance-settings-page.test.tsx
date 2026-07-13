import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AppearanceSettingsPage } from "@/features/settings/pages/appearance-settings-page";
import { useChatMessageLayoutStore } from "@/features/chat";
import { useSideDockStore } from "@/features/side-dock";

describe("AppearanceSettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useChatMessageLayoutStore.getState().setLayout("card");
    useSideDockStore.getState().setVisible(true);
    useSideDockStore.getState().setPinnedItems([]);
  });

  it("reopens the SideDock from the appearance settings switch", () => {
    useSideDockStore.getState().setVisible(false);

    render(<AppearanceSettingsPage />);

    const visibilitySwitch = screen.getByRole("switch", {
      name: "Show SideDock",
    });
    expect(visibilitySwitch.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(visibilitySwitch);

    expect(useSideDockStore.getState().isVisible).toBe(true);
  });

  it("switches the chat message layout from appearance settings", () => {
    render(<AppearanceSettingsPage />);

    const cardOption = screen.getByRole("radio", { name: /^Cards/ });
    const flatOption = screen.getByRole("radio", { name: /^Flat/ });
    expect(cardOption.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(flatOption);

    expect(flatOption.getAttribute("aria-checked")).toBe("true");
    expect(useChatMessageLayoutStore.getState().layout).toBe("flat");
  });
});
