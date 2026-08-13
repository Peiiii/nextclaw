import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { AppInstanceStorageService } from "./app-instance-storage.service.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.map(async (entry) =>
    await rm(entry, { recursive: true, force: true })));
  cleanupPaths.length = 0;
});

describe("AppInstanceStorageService", () => {
  it("materializes an isolated default instance with typed directories", async () => {
    const appHome = createTemporaryPath("nextclaw-app-storage");
    cleanupPaths.push(appHome);
    const service = new AppInstanceStorageService(new AppHomeService(appHome));

    const instance = await service.materializeDefaultInstance({
      appId: "example.notes",
    });

    expect(instance).toMatchObject({
      id: "default",
      dataSchemaVersion: 1,
      storage: {
        layout: "instance-v1",
        instanceId: "default",
      },
    });
    for (const directory of [
      instance.storage.dataDirectory,
      instance.storage.configDirectory,
      instance.storage.stateDirectory,
      instance.storage.cacheDirectory,
      instance.storage.temporaryDirectory,
      instance.storage.logsDirectory,
    ]) {
      await expect(access(directory)).resolves.toBeUndefined();
    }
    const metadata = JSON.parse(
      await readFile(path.join(instance.storage.instanceDirectory, "metadata.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(metadata).toMatchObject({
      schemaVersion: 1,
      appId: "example.notes",
      instanceId: "default",
      layoutVersion: 1,
    });
  });

  it("moves legacy data once and preserves it in the durable data directory", async () => {
    const appHome = createTemporaryPath("nextclaw-app-storage-migration");
    cleanupPaths.push(appHome);
    const homeService = new AppHomeService(appHome);
    const legacyDataDirectory = homeService.getAppDataDirectory("example.notes");
    await mkdir(legacyDataDirectory, { recursive: true });
    await writeFile(path.join(legacyDataDirectory, "notes.json"), "[]\n", "utf8");
    const service = new AppInstanceStorageService(homeService);

    const first = await service.materializeDefaultInstance({
      appId: "example.notes",
      legacyDataDirectory,
    });
    const second = await service.materializeDefaultInstance({
      appId: "example.notes",
      legacyDataDirectory,
    });

    await expect(access(legacyDataDirectory)).rejects.toThrow();
    await expect(readFile(path.join(first.storage.dataDirectory, "notes.json"), "utf8"))
      .resolves.toBe("[]\n");
    expect(second.storage).toEqual(first.storage);
    expect(first.migratedAt).toBeTruthy();
    expect(first.legacyDataDirectory).toBe(path.resolve(legacyDataDirectory));
  });

  it("measures each storage class without following symbolic links", async () => {
    const appHome = createTemporaryPath("nextclaw-app-storage-usage");
    cleanupPaths.push(appHome);
    const service = new AppInstanceStorageService(new AppHomeService(appHome));
    const instance = await service.materializeDefaultInstance({ appId: "example.notes" });
    await writeFile(path.join(instance.storage.dataDirectory, "data.bin"), Buffer.alloc(11));
    await writeFile(path.join(instance.storage.cacheDirectory, "cache.bin"), Buffer.alloc(7));

    await expect(service.measureUsage(instance.storage)).resolves.toMatchObject({
      dataBytes: 11,
      cacheBytes: 7,
      totalBytes: 18,
    });
  });

  it("rejects path-like instance identities", async () => {
    const appHome = createTemporaryPath("nextclaw-app-storage-invalid");
    cleanupPaths.push(appHome);
    const service = new AppInstanceStorageService(new AppHomeService(appHome));

    await expect(service.materializeDefaultInstance({ appId: "../escape" }))
      .rejects.toThrow("安全");
  });
});

function createTemporaryPath(prefix: string): string {
  return path.join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}
