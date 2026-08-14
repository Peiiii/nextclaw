import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { AppInstanceInventoryService } from "./app-instance-inventory.service.js";
import { AppInstanceStorageService } from "./app-instance-storage.service.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.map(async (entry) =>
    await rm(entry, { recursive: true, force: true })));
  cleanupPaths.length = 0;
});

describe("AppInstanceInventoryService", () => {
  it("lists standard instances with identity and per-class usage", async () => {
    const appHome = createTemporaryPath("nextclaw-app-inventory");
    cleanupPaths.push(appHome);
    const homeService = new AppHomeService(appHome);
    const storageService = new AppInstanceStorageService(homeService);
    const instance = await storageService.materializeDefaultInstance({
      appId: "example.notes",
      publisherId: "example",
    });
    await writeFile(path.join(instance.storage.dataDirectory, "note.txt"), "hello", "utf8");
    await writeFile(path.join(instance.storage.logsDirectory, "app.log"), "ok", "utf8");

    await expect(new AppInstanceInventoryService(storageService)
      .list(homeService.getInstancesDirectory()))
      .resolves.toMatchObject({
        entries: [{
          appId: "example.notes",
          instanceId: "default",
          publisherId: "example",
          usage: {
            dataBytes: 5,
            logsBytes: 2,
            totalBytes: 7,
          },
        }],
        diagnostics: [],
      });
  });

  it("reports invalid metadata without turning it into a deletable entry", async () => {
    const instancesRoot = createTemporaryPath("nextclaw-app-inventory-invalid");
    cleanupPaths.push(instancesRoot);
    const instanceDirectory = path.join(instancesRoot, "example.notes", "default");
    await mkdir(instanceDirectory, { recursive: true });
    await writeFile(path.join(instanceDirectory, "metadata.json"), "{}\n", "utf8");

    const inventory = await new AppInstanceInventoryService().list(instancesRoot);

    expect(inventory.entries).toEqual([]);
    expect(inventory.diagnostics).toEqual([expect.objectContaining({
      instanceDirectory,
      message: expect.stringContaining("无效"),
    })]);
  });

  it("purges only the metadata-bound instance and rejects path identities", async () => {
    const appHome = createTemporaryPath("nextclaw-app-inventory-purge");
    cleanupPaths.push(appHome);
    const homeService = new AppHomeService(appHome);
    const storageService = new AppInstanceStorageService(homeService);
    const instance = await storageService.materializeDefaultInstance({ appId: "example.notes" });
    const service = new AppInstanceInventoryService(storageService);

    await service.purge({
      instancesRoot: homeService.getInstancesDirectory(),
      appId: "example.notes",
      instanceId: "default",
    });

    await expect(access(instance.storage.instanceDirectory)).rejects.toThrow();
    await expect(service.purge({
      instancesRoot: homeService.getInstancesDirectory(),
      appId: "../escape",
      instanceId: "default",
    })).rejects.toThrow("安全");
  });

  it("reports committed deletion tombstones and removes them during explicit reconciliation", async () => {
    const appHome = createTemporaryPath("nextclaw-app-inventory-reconcile");
    cleanupPaths.push(appHome);
    const homeService = new AppHomeService(appHome);
    const storageService = new AppInstanceStorageService(homeService);
    const instance = await storageService.materializeDefaultInstance({ appId: "example.notes" });
    const stagedPath = `${instance.storage.instanceDirectory}.deleting-123e4567-e89b-42d3-a456-426614174000`;
    await rename(instance.storage.instanceDirectory, stagedPath);
    const service = new AppInstanceInventoryService(storageService);

    await expect(service.list(homeService.getInstancesDirectory())).resolves.toMatchObject({
      entries: [],
      diagnostics: [{
        instanceDirectory: stagedPath,
        message: expect.stringContaining("等待启动恢复"),
      }],
    });
    await expect(service.reconcileDeletions(homeService.getInstancesDirectory()))
      .resolves.toEqual([]);
    await expect(access(stagedPath)).rejects.toThrow();
  });

  it("keeps an unverifiable deletion tombstone and returns a diagnostic", async () => {
    const instancesRoot = createTemporaryPath("nextclaw-app-inventory-reconcile-invalid");
    cleanupPaths.push(instancesRoot);
    const stagedPath = path.join(
      instancesRoot,
      "example.notes",
      "default.deleting-123e4567-e89b-42d3-a456-426614174000",
    );
    await mkdir(stagedPath, { recursive: true });
    await writeFile(path.join(stagedPath, "metadata.json"), "{}\n", "utf8");

    await expect(new AppInstanceInventoryService().reconcileDeletions(instancesRoot))
      .resolves.toEqual([expect.objectContaining({
        instanceDirectory: stagedPath,
        message: expect.stringContaining("恢复失败"),
      })]);
    await expect(access(stagedPath)).resolves.toBeUndefined();
  });
});

function createTemporaryPath(prefix: string): string {
  return path.join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}
