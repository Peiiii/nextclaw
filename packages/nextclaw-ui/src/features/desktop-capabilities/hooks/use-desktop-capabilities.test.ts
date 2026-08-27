import { describe, expect, it } from "vitest";
import { isDesktopAutomationAvailable } from "./use-desktop-capabilities";

describe("isDesktopAutomationAvailable", () => {
  it("uses only the backend product feature-control value", () => {
    expect(isDesktopAutomationAvailable({ desktopAutomation: { available: true } })).toBe(true);
    expect(isDesktopAutomationAvailable({ desktopAutomation: { available: false } })).toBe(false);
    expect(isDesktopAutomationAvailable(undefined)).toBe(false);
  });
});
