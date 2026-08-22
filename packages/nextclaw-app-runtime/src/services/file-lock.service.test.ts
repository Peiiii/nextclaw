import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileLockBusyError, FileLockService } from "./file-lock.service.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.map(async (entryPath) =>
    await rm(entryPath, { recursive: true, force: true })));
  cleanupPaths.length = 0;
});

describe("FileLockService", () => {
  it("serializes lock owners across service instances", async () => {
    const directory = createTemporaryPath("napp-file-lock");
    const lockPath = path.join(directory, "registry.lock");
    cleanupPaths.push(directory);
    let releaseFirst: (() => void) | undefined;
    let signalFirstStarted: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      signalFirstStarted = resolve;
    });
    const events: string[] = [];

    const first = new FileLockService().withLock(lockPath, async () => {
      events.push("first-start");
      signalFirstStarted?.();
      await firstGate;
      events.push("first-end");
    });
    const second = new FileLockService().withLock(lockPath, async () => {
      events.push("second-start");
    });

    await firstStarted;
    expect(events).toEqual(["first-start"]);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("recovers a lock left by a terminated process", async () => {
    const directory = createTemporaryPath("napp-stale-file-lock");
    const lockPath = path.join(directory, "registry.lock");
    cleanupPaths.push(directory);
    await mkdir(directory, { recursive: true });
    await writeFile(lockPath, `${JSON.stringify({
      token: "stale-token",
      pid: 999_999_999,
      createdAt: "2026-08-14T00:00:00.000Z",
    })}\n`);

    await expect(new FileLockService().withLock(lockPath, async () => "recovered"))
      .resolves.toBe("recovered");
  });

  it("exposes a non-waiting lease for process lifetime ownership", async () => {
    const directory = createTemporaryPath("napp-file-lease");
    const lockPath = path.join(directory, "runtime.lock");
    cleanupPaths.push(directory);

    const first = await new FileLockService().acquireLease(lockPath);
    await expect(new FileLockService().acquireLease(lockPath))
      .rejects.toBeInstanceOf(FileLockBusyError);

    await first.release();
    const second = await new FileLockService().acquireLease(lockPath);
    await second.release();
  });
});

function createTemporaryPath(prefix: string): string {
  return path.join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}
