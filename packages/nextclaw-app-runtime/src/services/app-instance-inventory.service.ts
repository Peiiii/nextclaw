import { randomUUID } from "node:crypto";
import { access, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { AppInstanceStorageService } from "#app-runtime/services/app-instance-storage.service.js";
import { FileLockService } from "#app-runtime/services/file-lock.service.js";
import type {
  AppInstanceInventory,
  AppInstanceInventoryEntry,
} from "#app-runtime/types/app-storage.types.js";

const SAFE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export class AppInstanceInventoryService {
  private readonly fileLockService = new FileLockService();

  constructor(
    private readonly storageService = new AppInstanceStorageService(),
  ) {}

  list = async (instancesRoot: string): Promise<AppInstanceInventory> => {
    const root = path.resolve(instancesRoot);
    const entries: AppInstanceInventoryEntry[] = [];
    const diagnostics: AppInstanceInventory["diagnostics"] = [];
    for (const appDirectory of await this.listDirectories(root)) {
      const appId = appDirectory.name;
      const appPath = path.join(root, appId);
      if (!SAFE_ID_PATTERN.test(appId)) {
        diagnostics.push({
          instanceDirectory: appPath,
          message: `不安全的 App Instance appId：${appId}`,
        });
        continue;
      }
      for (const instanceDirectory of await this.listDirectories(appPath)) {
        const instanceId = instanceDirectory.name;
        const instancePath = path.join(appPath, instanceId);
        if (!SAFE_ID_PATTERN.test(instanceId)) {
          diagnostics.push({
            instanceDirectory: instancePath,
            message: `不安全的 App Instance instanceId：${instanceId}`,
          });
          continue;
        }
        try {
          const instance = await this.storageService.inspect({
            appId,
            instanceId,
            instanceDirectory: instancePath,
          });
          const usage = await this.storageService.measureUsage(instance.storage);
          entries.push({
            appId,
            instanceId,
            publisherId: instance.publisherId,
            storage: instance.storage,
            usage,
            createdAt: instance.createdAt,
            migratedAt: instance.migratedAt,
          });
        } catch (error) {
          diagnostics.push({
            instanceDirectory: instancePath,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    entries.sort((left, right) =>
      left.appId.localeCompare(right.appId) || left.instanceId.localeCompare(right.instanceId));
    diagnostics.sort((left, right) =>
      left.instanceDirectory.localeCompare(right.instanceDirectory));
    return { entries, diagnostics };
  };

  purge = async (params: {
    instancesRoot: string;
    appId: string;
    instanceId: string;
    assertCanPurge?: () => Promise<void>;
  }): Promise<void> => {
    const { appId, assertCanPurge, instanceId, instancesRoot } = params;
    return await this.purgeNested({
      instancesRoot,
      pathSegments: [appId, instanceId],
      appId,
      instanceId,
      assertCanPurge,
    });
  };

  purgeNested = async (params: {
    instancesRoot: string;
    pathSegments: string[];
    appId: string;
    instanceId: string;
    assertCanPurge?: () => Promise<void>;
  }): Promise<void> => {
    const { appId, assertCanPurge, instanceId, instancesRoot, pathSegments } = params;
    this.assertSafeId(appId, "appId");
    this.assertSafeId(instanceId, "instanceId");
    if (pathSegments.length === 0) {
      throw new Error("App Instance 相对路径不能为空。");
    }
    pathSegments.forEach((segment, index) =>
      this.assertSafeId(segment, `pathSegments[${index}]`));
    const root = path.resolve(instancesRoot);
    const instanceDirectory = path.resolve(root, ...pathSegments);
    this.assertWithinRoot(root, instanceDirectory);
    await this.fileLockService.withLock(`${instanceDirectory}.lock`, async () => {
      await assertCanPurge?.();
      await this.storageService.inspect({
        appId,
        instanceId,
        instanceDirectory,
      });
      const stagingDirectory = `${instanceDirectory}.deleting-${randomUUID()}`;
      await rename(instanceDirectory, stagingDirectory);
      try {
        await rm(stagingDirectory, { recursive: true });
      } catch (error) {
        try {
          if (!await this.pathExists(instanceDirectory)) {
            await rename(stagingDirectory, instanceDirectory);
          }
        } catch (restoreError) {
          throw new AggregateError(
            [error, restoreError],
            `App Instance 删除失败且恢复失败：${appId}/${instanceId}`,
          );
        }
        throw error;
      }
    });
  };

  private listDirectories = async (directory: string) => {
    try {
      return (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return [];
      }
      throw error;
    }
  };

  private assertSafeId = (value: string, field: string): void => {
    if (!SAFE_ID_PATTERN.test(value)) {
      throw new Error(`${field} 不是安全的 App Instance 标识：${value}`);
    }
  };

  private assertWithinRoot = (root: string, target: string): void => {
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`App Instance 路径不在受管根目录内：${target}`);
    }
  };

  private pathExists = async (targetPath: string): Promise<boolean> => {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
