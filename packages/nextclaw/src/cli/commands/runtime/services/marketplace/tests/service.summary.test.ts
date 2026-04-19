import { describe, expect, it } from "vitest";
import { pickUserFacingCommandSummary } from "../../../index.js";

describe("pickUserFacingCommandSummary", () => {
  it("hides absolute path line and keeps user-facing install summary", () => {
    const output = [
      "✓ Installed docx (marketplace)",
      "Path: /Users/tongwenwen/.nextclaw/workspace/skills/docx"
    ].join("\n");

    expect(pickUserFacingCommandSummary(output, "Installed skill: docx")).toBe("✓ Installed docx (marketplace)");
  });

  it("falls back when output only contains filesystem paths", () => {
    const output = [
      "Copied builtin skill to /Users/tongwenwen/.nextclaw/workspace/skills/weather",
      "Path: /Users/tongwenwen/.nextclaw/workspace/skills/weather"
    ].join("\n");

    expect(pickUserFacingCommandSummary(output, "Installed skill: weather")).toBe("Installed skill: weather");
  });

  it("keeps non-technical action summary", () => {
    const output = [
      "Downloading package...",
      "Enabled plugin: builtin-channel-discord"
    ].join("\n");

    expect(pickUserFacingCommandSummary(output, "Enabled plugin: builtin-channel-discord")).toBe(
      "Enabled plugin: builtin-channel-discord"
    );
  });
});
