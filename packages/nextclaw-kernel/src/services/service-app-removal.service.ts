import { randomUUID } from "node:crypto";
import { access, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { FileLockService } from "@nextclaw/app-runtime";
import type { ServiceActionGrant, ServiceAppRecord } from "@kernel/types/service-app.types.js";
import type { ServiceActionGrantStore } from "@kernel/stores/service-action-grant.store.js";
import { readServiceAppManifest } from "@kernel/utils/service-app-manifest.utils.js";

type StagedPath = {
  originalPath: string;
  stagedPath: string;
};

export type ServiceAppRemovalDiagnostic = {
  appId: string;
  stagedPath: string;
  message: string;
};

const TRANSACTION_ID = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const CURRENT_DELETION_PATTERN = new RegExp(`^\\.deleting-(?<appId>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<transactionId>${TRANSACTION_ID})$`);
const LEGACY_DELETION_PATTERN = new RegExp(`^(?<appId>[a-z0-9]+(?:-[a-z0-9]+)*)\\.deleting-(?<transactionId>${TRANSACTION_ID})$`);

export function isServiceAppDeletionTombstone(directoryName: string): boolean {
  return Boolean(parseServiceAppDeletionTombstone(directoryName));
}

export class ServiceAppRemovalCleanupError extends Error {
  constructor(readonly cause: unknown) {
    super(
      `临时目录清理失败：${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = "ServiceAppRemovalCleanupError";
  }
}

export class ServiceAppRemovalService {
  private readonly fileLockService = new FileLockService();

  listCanonicalDirectoryNames = async (serviceAppsPath: string): Promise<string[]> =>
    (await this.listDirectories(serviceAppsPath))
      .filter((directoryName) =>
        !directoryName.startsWith(".") && !isServiceAppDeletionTombstone(directoryName));

  remove = async (params: {
    grantStore: ServiceActionGrantStore;
    loadRecord: () => Promise<ServiceAppRecord>;
    lockPath: string;
    purgeData: boolean;
    stopRuntime: (record: ServiceAppRecord) => Promise<void>;
  }): Promise<ServiceAppRecord> => await this.fileLockService.withLock(
    params.lockPath,
    async () => {
      const record = await params.loadRecord();
      await this.removeLocked({ ...params, record });
      return record;
    },
  );

  reconcile = async (params: {
    grantStore: ServiceActionGrantStore;
    lockPathForAppId: (appId: string) => string;
    serviceAppsPath: string;
  }): Promise<ServiceAppRemovalDiagnostic[]> => {
    const { grantStore, lockPathForAppId, serviceAppsPath } = params;
    const diagnostics: ServiceAppRemovalDiagnostic[] = [];
    for (const directoryName of await this.listDirectories(serviceAppsPath)) {
      const appId = parseServiceAppDeletionTombstone(directoryName);
      if (!appId) {
        continue;
      }
      const stagedPath = join(serviceAppsPath, directoryName);
      const canonicalPath = join(serviceAppsPath, appId);
      try {
        await this.fileLockService.withLock(lockPathForAppId(appId), async () => {
          const manifest = await readServiceAppManifest(stagedPath);
          if (manifest.id !== appId) {
            throw new Error(`Service App 删除墓碑 identity 不匹配：${manifest.id}`);
          }
          if (!await this.pathExists(canonicalPath)) {
            await grantStore.revokeActionsByPrefix(`${appId}.`);
          }
          await rm(stagedPath, { recursive: true });
        });
      } catch (error) {
        diagnostics.push({
          appId,
          stagedPath,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return diagnostics.sort((left, right) => left.stagedPath.localeCompare(right.stagedPath));
  };

  private removeLocked = async (params: {
    grantStore: ServiceActionGrantStore;
    purgeData: boolean;
    record: ServiceAppRecord;
    stopRuntime: (record: ServiceAppRecord) => Promise<void>;
  }): Promise<void> => {
    const { grantStore, purgeData, record, stopRuntime } = params;
    const grants = (await grantStore.list())
      .filter((grant) => grant.actionId.startsWith(`${record.id}.`));
    const stagedPaths: StagedPath[] = [];
    try {
      await stopRuntime(record);
      await this.stageSourcePath(record.dirPath, stagedPaths);
      if (purgeData && record.storage) {
        await this.stageInstancePath(record.storage.instanceDirectory, stagedPaths);
      }
      await grantStore.revokeActionsByPrefix(`${record.id}.`);
    } catch (error) {
      const recoveryErrors = [
        ...await this.restoreStagedPaths(stagedPaths),
        ...await this.restoreGrants(grantStore, grants),
      ];
      if (recoveryErrors.length > 0) {
        throw new AggregateError(
          [error, ...recoveryErrors],
          `Service App ${record.id} 删除失败，且恢复未完整完成。`,
        );
      }
      throw error;
    }
    try {
      await Promise.all(stagedPaths.map(async ({ stagedPath }) =>
        await rm(stagedPath, { recursive: true })));
    } catch (error) {
      throw new ServiceAppRemovalCleanupError(error);
    }
  };

  private stageSourcePath = async (
    originalPath: string,
    stagedPaths: StagedPath[],
  ): Promise<void> => {
    const stagedPath = join(
      dirname(originalPath),
      `.deleting-${basename(originalPath)}-${randomUUID()}`,
    );
    await rename(originalPath, stagedPath);
    stagedPaths.push({ originalPath, stagedPath });
  };

  private stageInstancePath = async (
    originalPath: string,
    stagedPaths: StagedPath[],
  ): Promise<void> => {
    const stagedPath = `${originalPath}.deleting-${randomUUID()}`;
    await rename(originalPath, stagedPath);
    stagedPaths.push({ originalPath, stagedPath });
  };

  private listDirectories = async (directory: string): Promise<string[]> => {
    try {
      return (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return [];
      }
      throw error;
    }
  };

  private pathExists = async (targetPath: string): Promise<boolean> => {
    try {
      await access(targetPath);
      return true;
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return false;
      }
      throw error;
    }
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";

  private restoreStagedPaths = async (stagedPaths: StagedPath[]): Promise<unknown[]> => {
    const errors: unknown[] = [];
    for (const entry of [...stagedPaths].reverse()) {
      try {
        await rename(entry.stagedPath, entry.originalPath);
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  };

  private restoreGrants = async (
    grantStore: ServiceActionGrantStore,
    grants: ServiceActionGrant[],
  ): Promise<unknown[]> => {
    const errors: unknown[] = [];
    for (const grant of grants) {
      try {
        await grantStore.grant(grant);
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  };
}

function parseServiceAppDeletionTombstone(directoryName: string): string | undefined {
  return CURRENT_DELETION_PATTERN.exec(directoryName)?.groups?.appId ??
    LEGACY_DELETION_PATTERN.exec(directoryName)?.groups?.appId;
}
