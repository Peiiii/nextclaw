import { describe, expect, it } from "vitest";
import { buildMarketplaceSkillInstallArgs } from "@/cli/shared/utils/marketplace/service-marketplace-helpers.utils.js";
import { resolveCliSubcommandEntry } from "@/cli/shared/utils/marketplace/cli-subcommand-launch.utils.js";

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
      argvEntry: "/tmp/dist/cli/app/index.js",
      importMetaUrl: "file:///tmp/dist/cli/app/index.js"
    });
    expect(entry).toBe("/tmp/dist/cli/app/index.js");
  });

  it("falls back to the app entry when argv entry is missing", () => {
    const entry = resolveCliSubcommandEntry({
      importMetaUrl: "file:///tmp/dist/cli/commands/service/index.js"
    });
    expect(entry).toBe("/tmp/dist/cli/app/index.js");
  });
});
