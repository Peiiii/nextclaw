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

describe("ExtensionLifecycleService timers and crashes", () => {
  it("stops the process after the final lease grace period", async () => {
    vi.useFakeTimers();
    const root = createTempDir();
    const child = createFakeChildProcess(4323);
    spawnMock.mockReturnValue(child);
    const lifecycle = new ExtensionLifecycleService({
      cleanupOrphanProcesses: () => undefined,
      stopGraceMs: 30,
    });
    const acquired = lifecycle.acquire(
      {
        id: "fake-extension",
        rootDir: root,
        server: { type: "stdio", command: "node", args: ["dist/index.js"] },
      },
      {
        endpoint: "http://127.0.0.1:55667",
        reason: { kind: "request", requestId: "request-1" },
      },
    );
    const spawned = readSpawnedExtension();
    lifecycle.markReady({
      extensionId: spawned.extensionId,
      generation: spawned.generation,
      pid: spawned.pid,
    });
    const lease = await acquired;
    lease.release();

    await vi.advanceTimersByTimeAsync(29);
    expect(child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it("rotates generation credentials after a crash and rejects stale ready signals", async () => {
    const root = createTempDir();
    const children = [
      createFakeChildProcess(4324),
      createFakeChildProcess(4325),
    ];
    spawnMock.mockImplementation(() => children.shift());
    const lifecycle = new ExtensionLifecycleService({
      cleanupOrphanProcesses: () => undefined,
      restartDelaysMs: [0],
    });
    const acquired = lifecycle.acquire(
      {
        id: "fake-extension",
        rootDir: root,
        server: { type: "stdio", command: "node", args: ["dist/index.js"] },
      },
      {
        endpoint: "http://127.0.0.1:55667",
        reason: { kind: "enabled-channel", channelId: "fake-channel" },
      },
    );
    const first = readSpawnedExtension();
    lifecycle.markReady({
      extensionId: first.extensionId,
      generation: first.generation,
      pid: first.pid,
    });
    await acquired;
    (spawnMock.mock.results[0]?.value as FakeChildProcess).emit(
      "exit",
      1,
      null,
    );
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(2));
    const second = readSpawnedExtension(1);

    expect(second.generation).not.toBe(first.generation);
    expect(second.token).not.toBe(first.token);
    expect(
      lifecycle.authenticateCredential({
        extensionId: first.extensionId,
        generation: first.generation,
        token: first.token,
      }),
    ).toBeNull();
    expect(() =>
      lifecycle.markReady({
        extensionId: first.extensionId,
        generation: first.generation,
        pid: first.pid,
      }),
    ).toThrow("Stale extension ready signal rejected");
    lifecycle.markReady({
      extensionId: second.extensionId,
      generation: second.generation,
      pid: second.pid,
    });
  });
});
