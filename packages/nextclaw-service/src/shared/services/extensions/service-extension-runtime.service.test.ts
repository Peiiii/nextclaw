import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveBuiltinExtensionManifestRoots,
  resolveExtensionManifestRoots,
  startDiscoveredExtensions,
} from "./service-extension-runtime.service.js";
import {
  ExtensionManifestDiscoveryService,
  type ExtensionLifecycleService,
  type ExtensionManifest,
} from "./extension-lifecycle.service.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-service-extension-startup-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("resolveExtensionManifestRoots", () => {
  it("includes bundled extension packages so production service installs can discover them", () => {
    const roots = resolveBuiltinExtensionManifestRoots();

    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-weixin"))).toBe(true);
  });

  it("uses NextClaw extension directories and existing configured load paths", () => {
    const workspace = createTempDir();
    const roots = resolveExtensionManifestRoots({
      workspace,
      config: {
        plugins: {
          load: {
            paths: [workspace],
          },
        },
      } as never,
    });

    expect(roots).toContain(join(workspace, ".nextclaw", "extensions"));
    expect(roots.filter((root) => root === workspace)).toHaveLength(1);
  });
});

describe("startDiscoveredExtensions", () => {
  it("starts discovered manifest processes with the shared ingress token", async () => {
    const root = createTempDir();
    const originalDevExtensionDir = process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR;
    process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR = join(createTempDir(), "missing");
    const extensionDir = join(root, "fake-extension");
    mkdirSync(extensionDir);
    writeFileSync(join(extensionDir, "nextclaw.extension.json"), JSON.stringify({
      id: "fake-extension",
      server: {
        type: "stdio",
        command: "node",
        args: ["dist/index.js"],
      },
    }));
    const lifecycle = {
      startAll: vi.fn(async (manifests: ExtensionManifest[]) =>
      manifests.map((manifest) => ({ manifest, process: {} })),
      ),
    };

    try {
      const result = await startDiscoveredExtensions({
        config: {
          plugins: {
            load: {
              paths: [root],
            },
          },
        } as never,
        workspace: createTempDir(),
        endpoint: "http://127.0.0.1:55667",
        token: "shared-token",
        discovery: new ExtensionManifestDiscoveryService(),
        lifecycle: lifecycle as unknown as ExtensionLifecycleService,
      });

      expect(result.running.map((entry) => entry.manifest)).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: "fake-extension",
          rootDir: extensionDir,
        }),
      ]));
    } finally {
      if (originalDevExtensionDir === undefined) {
        delete process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR;
      } else {
        process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR = originalDevExtensionDir;
      }
    }
  });
});
