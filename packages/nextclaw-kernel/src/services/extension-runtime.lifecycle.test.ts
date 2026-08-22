import type * as ChildProcessModule from "node:child_process";
import { describe, expect, it, vi } from "vitest";

const extensionRuntimeMocks = vi.hoisted(() => {
  const spawnMock = vi.fn();
  (globalThis as typeof globalThis & { __nextclawExtensionSpawnMock: typeof spawnMock }).__nextclawExtensionSpawnMock = spawnMock;
  return { spawnMock };
});
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>();
  return { ...actual, spawn: extensionRuntimeMocks.spawnMock };
});
import { ExtensionLifecycleService } from "@kernel/features/extension-runtime/index.js";
import { createFakeChildProcess, createTempDir, readSpawnedExtension, spawnMock } from "./extension-runtime.test-fixtures.js";
import "./extension-runtime.test-fixtures.js";

describe("ExtensionLifecycleService", () => {
  it("cleans orphan extension processes before spawning extensions", async () => {
    const root = createTempDir();
    const cleanupOrphanProcesses = vi.fn();
    spawnMock.mockImplementation(() => createFakeChildProcess(4321));
    const manifest = {
      id: "fake-extension",
      rootDir: root,
      server: {
        type: "stdio",
        command: "node",
        args: ["dist/index.js"],
      },
    } as const;
    const lifecycle = new ExtensionLifecycleService({ cleanupOrphanProcesses });

    const acquired = lifecycle.acquire(manifest, {
      endpoint: "http://127.0.0.1:55667",
      reason: { kind: "enabled-channel", channelId: "fake-channel" },
    });

    expect(cleanupOrphanProcesses.mock.invocationCallOrder[0]).toBeLessThan(
      spawnMock.mock.invocationCallOrder[0] ?? 0,
    );
    expect(cleanupOrphanProcesses).toHaveBeenCalledWith([manifest]);
    const [, , options] = spawnMock.mock.calls[0] as unknown as [
      string,
      string[],
      { env: NodeJS.ProcessEnv },
    ];
    lifecycle.markReady({
      extensionId: manifest.id,
      generation: String(options.env.NEXTCLAW_EXTENSION_GENERATION),
      pid: 4321,
    });
    await acquired;
  });

  it("does not inherit ambient environment variables into extension processes", async () => {
    const root = createTempDir();
    const original = process.env.NEXTCLAW_TEST_EXTENSION_SECRET;
    process.env.NEXTCLAW_TEST_EXTENSION_SECRET = "must-not-leak";
    spawnMock.mockImplementation(() => createFakeChildProcess(4320));
    const lifecycle = new ExtensionLifecycleService({
      cleanupOrphanProcesses: () => undefined,
    });
    try {
      const acquired = lifecycle.acquire(
        {
          id: "fake-extension",
          rootDir: root,
          server: {
            type: "stdio",
            command: "node",
            args: ["dist/index.js"],
            env: { EXPLICIT_EXTENSION_VALUE: "available" },
          },
        },
        {
          endpoint: "http://127.0.0.1:55667",
          reason: { kind: "enabled-channel", channelId: "fake-channel" },
        },
      );
      const spawned = readSpawnedExtension();
      const [, , options] = spawnMock.mock.calls[0] as unknown as [
        string,
        string[],
        { env: NodeJS.ProcessEnv },
      ];
      expect(options.env.NEXTCLAW_TEST_EXTENSION_SECRET).toBeUndefined();
      expect(options.env.EXPLICIT_EXTENSION_VALUE).toBe("available");
      expect(options.env.PATH ?? options.env.Path).toBeTruthy();
      lifecycle.markReady({
        extensionId: spawned.extensionId,
        generation: spawned.generation,
        pid: spawned.pid,
      });
      await acquired;
    } finally {
      if (original === undefined)
        delete process.env.NEXTCLAW_TEST_EXTENSION_SECRET;
      else process.env.NEXTCLAW_TEST_EXTENSION_SECRET = original;
    }
  });

  it("passes generation-scoped credentials and the service pid to spawned extension processes", async () => {
    const root = createTempDir();
    spawnMock.mockImplementation(() => createFakeChildProcess(4321));
    const lifecycle = new ExtensionLifecycleService({
      cleanupOrphanProcesses: () => undefined,
    });

    const acquired = lifecycle.acquire(
      {
        id: "fake-extension",
        rootDir: root,
        server: {
          type: "stdio",
          command: "node",
          args: ["dist/index.js"],
        },
      },
      {
        endpoint: "http://127.0.0.1:55667",
        reason: { kind: "enabled-channel", channelId: "fake-channel" },
      },
    );

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [, , options] = spawnMock.mock.calls[0] as unknown as [
      string,
      string[],
      { env: NodeJS.ProcessEnv },
    ];
    expect(options.env).toEqual(
      expect.objectContaining({
        NEXTCLAW_EXTENSION_ID: "fake-extension",
        NEXTCLAW_EXTENSION_ENDPOINT: "http://127.0.0.1:55667",
        NEXTCLAW_EXTENSION_GENERATION: expect.any(String),
        NEXTCLAW_EXTENSION_PARENT_PID: String(process.pid),
        NEXTCLAW_EXTENSION_TOKEN: expect.any(String),
      }),
    );
    lifecycle.markReady({
      extensionId: "fake-extension",
      generation: String(options.env.NEXTCLAW_EXTENSION_GENERATION),
      pid: 4321,
    });
    await acquired;
  });

  it("shares one spawn and ready promise across twenty concurrent leases", async () => {
    const root = createTempDir();
    spawnMock.mockImplementation(() => createFakeChildProcess(4322));
    const lifecycle = new ExtensionLifecycleService({
      cleanupOrphanProcesses: () => undefined,
    });
    const manifest = {
      id: "fake-extension",
      rootDir: root,
      server: { type: "stdio", command: "node", args: ["dist/index.js"] },
    } as const;

    const acquired = Array.from({ length: 20 }, (_, index) =>
      lifecycle.acquire(manifest, {
        endpoint: "http://127.0.0.1:55667",
        reason: { kind: "request", requestId: `request-${index}` },
      }),
    );
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const spawned = readSpawnedExtension(0);
    lifecycle.markReady({
      extensionId: spawned.extensionId,
      generation: spawned.generation,
      pid: spawned.pid,
    });
    const leases = await Promise.all(acquired);

    expect(new Set(leases.map((lease) => lease.generation))).toEqual(
      new Set([spawned.generation]),
    );
    expect(lifecycle.getStatus()[0]?.leaseReasons).toHaveLength(20);
  });
});
