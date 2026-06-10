import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUILTIN_CHANNEL_IDS, isBuiltinChannelId } from "@nextclaw/runtime";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../..");

describe("builtin channel surface", () => {
  it("includes weixin in the product builtin channel set", () => {
    expect(BUILTIN_CHANNEL_IDS).toContain("weixin");
    expect(isBuiltinChannelId("weixin")).toBe(true);
  });

  it("requires builtin channel extensions to declare an extension manifest", () => {
    for (const channelId of BUILTIN_CHANNEL_IDS) {
      const packageDir = path.join(
        repoRoot,
        "packages/extensions",
        `nextclaw-channel-extension-${channelId}`,
      );
      expect(
        fs.existsSync(path.join(packageDir, "nextclaw.extension.json")),
        `builtin channel extension "${channelId}" must declare nextclaw.extension.json`,
      ).toBe(true);
    }
  });
});
