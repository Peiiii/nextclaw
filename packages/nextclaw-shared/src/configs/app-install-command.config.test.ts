import { describe, expect, it } from "vitest";
import { formatNextClawAppInstallCommand } from "./app-install-command.config.js";

describe("formatNextClawAppInstallCommand", () => {
  it("derives the public install command from the App identifier", () => {
    expect(formatNextClawAppInstallCommand(" nextclaw.personal-organizer "))
      .toBe("nextclaw app install nextclaw.personal-organizer");
  });

  it("rejects an absent App identifier", () => {
    expect(() => formatNextClawAppInstallCommand("  ")).toThrow("App id is required");
  });
});
