import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUILTIN_CHANNEL_PLUGIN_IDS, isBuiltinChannelPluginId } from "@nextclaw/runtime";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../../..");

describe("builtin channel surface", () => {
  it("includes weixin in the product builtin channel set", () => {
    expect(BUILTIN_CHANNEL_PLUGIN_IDS).toContain("weixin");
    expect(isBuiltinChannelPluginId("weixin")).toBe(true);
  });

  it("requires every builtin channel plugin to declare a development source entry", () => {
    for (const channelId of BUILTIN_CHANNEL_PLUGIN_IDS) {
      const packageDir = path.join(
        repoRoot,
        "packages/extensions",
        `nextclaw-channel-plugin-${channelId}`,
      );
      const packageJsonPath = path.join(packageDir, "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
        openclaw?: {
          development?: {
            extensions?: string[];
          };
        };
      };

      const extensions = packageJson.openclaw?.development?.extensions ?? [];
      expect(
        extensions,
        `builtin channel plugin "${channelId}" must declare openclaw.development.extensions`,
      ).not.toHaveLength(0);

      for (const extensionPath of extensions) {
        expect(
          fs.existsSync(path.join(packageDir, extensionPath)),
          `builtin channel plugin "${channelId}" development entry must exist: ${extensionPath}`,
        ).toBe(true);
      }
    }
  });
});
