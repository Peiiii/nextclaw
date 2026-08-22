import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBuiltinExtensionManifestRoots, resolveExtensionManifestRoots, resolvePackagedExtensionManifestRoots } from "@kernel/features/extension-runtime/index.js";
import { createTempDir } from "./extension-runtime.test-fixtures.js";
describe("resolveExtensionManifestRoots", () => {
  it("includes bundled extension packages so production service installs can discover them", () => {
    const roots = resolveBuiltinExtensionManifestRoots();

    expect(
      roots.some((root) =>
        root.endsWith("nextclaw-channel-extension-dingtalk"),
      ),
    ).toBe(true);
    expect(
      roots.some((root) => root.endsWith("nextclaw-channel-extension-discord")),
    ).toBe(true);
    expect(
      roots.some((root) => root.endsWith("nextclaw-channel-extension-email")),
    ).toBe(true);
    expect(
      roots.some((root) => root.endsWith("nextclaw-channel-extension-slack")),
    ).toBe(true);
    expect(
      roots.some((root) =>
        root.endsWith("nextclaw-channel-extension-telegram"),
      ),
    ).toBe(true);
    expect(
      roots.some((root) => root.endsWith("nextclaw-channel-extension-wecom")),
    ).toBe(true);
    expect(
      roots.some((root) =>
        root.endsWith("nextclaw-channel-extension-whatsapp"),
      ),
    ).toBe(true);
    expect(
      roots.some((root) => root.endsWith("nextclaw-channel-extension-weixin")),
    ).toBe(true);
    expect(
      roots.some((root) => root.endsWith("nextclaw-channel-extension-qq")),
    ).toBe(true);
  });

  it("uses NextClaw extension directories", () => {
    const workspace = createTempDir();
    const roots = resolveExtensionManifestRoots({
      workspace,
      config: {} as never,
    });

    expect(roots).toContain(join(workspace, ".nextclaw", "extensions"));
  });

  it("keeps explicit packaged extension roots when builtin discovery is disabled", () => {
    const workspace = createTempDir();
    const packagedRoot = createTempDir();
    const originalPackagedRoot = process.env.NEXTCLAW_PACKAGED_EXTENSION_DIR;
    const originalDisableBuiltins =
      process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS;
    process.env.NEXTCLAW_PACKAGED_EXTENSION_DIR = packagedRoot;
    process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = "1";

    try {
      expect(resolveBuiltinExtensionManifestRoots()).toEqual([]);
      expect(resolvePackagedExtensionManifestRoots()).toEqual([packagedRoot]);
      expect(
        resolveExtensionManifestRoots({
          workspace,
          config: {} as never,
        }),
      ).toContain(packagedRoot);
    } finally {
      if (originalPackagedRoot === undefined) {
        delete process.env.NEXTCLAW_PACKAGED_EXTENSION_DIR;
      } else {
        process.env.NEXTCLAW_PACKAGED_EXTENSION_DIR = originalPackagedRoot;
      }
      if (originalDisableBuiltins === undefined) {
        delete process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS;
      } else {
        process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS =
          originalDisableBuiltins;
      }
    }
  });
});
