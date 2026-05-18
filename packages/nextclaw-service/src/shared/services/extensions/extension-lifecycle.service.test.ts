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
        rootDir: extensionDir,
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
    const originalNodeOptions = process.env.NODE_OPTIONS;
    process.env.NODE_OPTIONS = "--conditions=development --max-old-space-size=4096";
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

    try {
      service.start({
        id: "fake-extension",
        rootDir: "/tmp/fake-extension",
        server: {
          type: "stdio",
          command: "node",
          args: ["dist/index.js"],
          env: { EXTRA: "1" },
        },
      });

      expect(spawnProcess).toHaveBeenCalledWith(
        process.execPath,
        ["dist/index.js"],
        expect.objectContaining({
          cwd: "/tmp/fake-extension",
          env: expect.objectContaining({
            EXTRA: "1",
            NODE_OPTIONS: "--max-old-space-size=4096",
            NEXTCLAW_EXTENSION_ID: "fake-extension",
            NEXTCLAW_EXTENSION_ENDPOINT: "http://127.0.0.1:55667",
            NEXTCLAW_EXTENSION_TOKEN: "secret",
          }),
          stdio: ["ignore", "ignore", "inherit"],
          windowsHide: true,
        }),
      );
    } finally {
      if (originalNodeOptions === undefined) {
        delete process.env.NODE_OPTIONS;
      } else {
        process.env.NODE_OPTIONS = originalNodeOptions;
      }
    }
  });

  it("keeps starting later extension servers when one extension spawn throws synchronously", async () => {
    const child = new EventEmitter() as EventEmitter & {
      once: EventEmitter["once"];
      kill: ReturnType<typeof vi.fn>;
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
    };
    child.kill = vi.fn();
    child.exitCode = null;
    child.signalCode = null;
    const warn = vi.fn();
    const spawnProcess = vi.fn((command: string) => {
      if (command === "bad-command") {
        throw new Error("spawn ENOTDIR");
      }
      return child;
    });
    const service = new ExtensionLifecycleService({
      endpoint: "http://127.0.0.1:55667",
      token: "secret",
      logger: { warn },
      spawnProcess: spawnProcess as never,
    });

    await expect(service.startAll([
      {
        id: "bad-extension",
        rootDir: "/tmp/bad-extension",
        server: {
          type: "stdio",
          command: "bad-command",
        },
      },
      {
        id: "good-extension",
        rootDir: "/tmp/good-extension",
        server: {
          type: "stdio",
          command: "node",
          args: ["dist/index.js"],
        },
      },
    ])).resolves.toEqual([
      expect.objectContaining({
        manifest: expect.objectContaining({ id: "good-extension" }),
      }),
    ]);
    expect(warn).toHaveBeenCalledWith("Extension bad-extension failed to start: spawn ENOTDIR");
  });
});
