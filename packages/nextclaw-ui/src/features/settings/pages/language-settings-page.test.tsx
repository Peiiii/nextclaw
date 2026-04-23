import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageSettingsPage } from "@/features/settings/pages/language-settings-page";

const mocks = vi.hoisted(() => ({
  selectLanguage: vi.fn(),
}));

vi.mock("@/features/settings/hooks/use-language-preference", () => ({
  useLanguagePreference: () => ({
    currentLanguage: "en",
    currentLanguageLabel: "English",
    languageOptions: [
      { value: "en", label: "English" },
      { value: "zh", label: "中文" },
    ],
    selectLanguage: mocks.selectLanguage,
  }),
}));

describe("LanguageSettingsPage", () => {
  it("reuses the shared language preference model for a mobile-friendly list", () => {
    render(<LanguageSettingsPage />);

    expect(screen.getByRole("heading", { name: "Language" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "English" }).getAttribute(
        "aria-current",
      ),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "中文" }));

    expect(mocks.selectLanguage).toHaveBeenCalledWith("zh");
  });
});
