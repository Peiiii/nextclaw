import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppearanceSettingsPage } from "@/features/settings/pages/appearance-settings-page";
import { useChatMessageLayoutStore } from "@/features/chat";
import { useSideDockStore } from "@/features/side-dock";

const mocks = vi.hoisted(() => ({
  selectLanguage: vi.fn(),
  setTheme: vi.fn(),
}));

vi.mock("@/app/components/theme-provider", () => ({
  useTheme: () => ({ theme: "work", setTheme: mocks.setTheme }),
}));

vi.mock("@/features/settings/hooks/use-language-preference", () => ({
  useLanguagePreference: () => ({
    currentLanguage: "en",
    languageOptions: [
      { value: "en", label: "English" },
      { value: "zh", label: "中文" },
    ],
    selectLanguage: mocks.selectLanguage,
  }),
}));

describe("AppearanceSettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useChatMessageLayoutStore.getState().setLayout("card");
    useSideDockStore.getState().setVisible(true);
    useSideDockStore.getState().setPinnedItems([]);
    mocks.selectLanguage.mockClear();
    mocks.setTheme.mockClear();
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

  it("owns the persistent theme and interface language controls", () => {
    render(<AppearanceSettingsPage />);

    fireEvent.click(screen.getByRole("combobox", { name: "Theme" }));
    fireEvent.click(screen.getByRole("option", { name: "Night" }));
    expect(mocks.setTheme).toHaveBeenCalledWith("night");

    fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
    fireEvent.click(screen.getByRole("option", { name: "中文" }));
    expect(mocks.selectLanguage).toHaveBeenCalledWith("zh");
  });
});
