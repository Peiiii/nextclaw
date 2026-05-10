import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExtensionLifecycleService,
  ExtensionManifestDiscoveryService,
} from "./extension-lifecycle.service.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-extension-lifecycle-test-"));
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

describe("ExtensionManifestDiscoveryService", () => {
  it("discovers nextclaw extension manifests from extension roots", async () => {
    const root = createTempDir();
    const extensionDir = join(root, "fake-extension");
    writeFileSync(join(root, "placeholder"), "");
    mkdirSync(extensionDir);
    writeFileSync(join(extensionDir, "nextclaw.extension.json"), JSON.stringify({
      id: "fake-extension",
      server: {
        type: "stdio",
        command: "node",
        args: ["dist/index.js"],
      },
      contributes: {
        channels: [{ id: "fake" }],
      },
    }));

    await expect(new ExtensionManifestDiscoveryService().discover([root])).resolves.toEqual([
      expect.objectContaining({
        id: "fake-extension",
        server: expect.objectContaining({
          command: "node",
          args: ["dist/index.js"],
        }),
      }),
    ]);
  });
});

describe("ExtensionLifecycleService", () => {
  it("starts extension server commands with injected connection env", () => {
    const child = new EventEmitter() as EventEmitter & {
      once: EventEmitter["once"];
      kill: ReturnType<typeof vi.fn>;
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
    };
    child.kill = vi.fn();
    child.exitCode = null;
    child.signalCode = null;
    const spawnProcess = vi.fn(() => child);
    const service = new ExtensionLifecycleService({
      endpoint: "http://127.0.0.1:55667",
      token: "secret",
      spawnProcess: spawnProcess as never,
    });

    service.start({
      id: "fake-extension",
      server: {
        type: "stdio",
        command: "node",
        args: ["dist/index.js"],
        env: { EXTRA: "1" },
      },
    });

    expect(spawnProcess).toHaveBeenCalledWith(
      "node",
      ["dist/index.js"],
      expect.objectContaining({
        env: expect.objectContaining({
          EXTRA: "1",
          NEXTCLAW_EXTENSION_ID: "fake-extension",
          NEXTCLAW_EXTENSION_ENDPOINT: "http://127.0.0.1:55667",
          NEXTCLAW_EXTENSION_TOKEN: "secret",
        }),
        stdio: "ignore",
      }),
    );
  });
});
