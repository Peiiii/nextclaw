import { describe, expect, it } from "vitest";
import { buildMarketplaceSkillInstallArgs, resolveCliSubcommandEntry } from "../../../service.js";

describe("buildMarketplaceSkillInstallArgs", () => {
  it("always includes workspace and slug", () => {
    expect(
      buildMarketplaceSkillInstallArgs({
        slug: "docx",
        workspace: "/tmp/custom-workspace"
      })
    ).toEqual(["skills", "install", "docx", "--workdir", "/tmp/custom-workspace"]);
  });

  it("appends --force only when requested", () => {
    expect(
      buildMarketplaceSkillInstallArgs({
        slug: "docx",
        workspace: "/tmp/custom-workspace",
        force: true
      })
    ).toEqual(["skills", "install", "docx", "--workdir", "/tmp/custom-workspace", "--force"]);
  });
});

describe("resolveCliSubcommandEntry", () => {
  it("prefers argv entry to avoid bundled relative-path mismatch", () => {
    const entry = resolveCliSubcommandEntry({
      argvEntry: "/tmp/dist/cli/index.js",
      importMetaUrl: "file:///tmp/dist/cli/index.js"
    });
    expect(entry).toBe("/tmp/dist/cli/index.js");
  });

  it("falls back to legacy relative resolution when argv entry is missing", () => {
    const entry = resolveCliSubcommandEntry({
      importMetaUrl: "file:///tmp/dist/cli/commands/service.js"
    });
    expect(entry).toBe("/tmp/dist/cli/index.js");
  });
});
