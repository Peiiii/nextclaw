import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { FileLockService } from "@nextclaw/app-runtime";
import type { ServiceActionGrant, ServiceAppRecord } from "@kernel/types/service-app.types.js";
import type { ServiceActionGrantStore } from "@kernel/stores/service-action-grant.store.js";

type StagedPath = {
  originalPath: string;
  stagedPath: string;
};

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
      await this.stagePath(record.dirPath, stagedPaths);
      if (purgeData && record.storage) {
        await this.stagePath(record.storage.instanceDirectory, stagedPaths);
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

  private stagePath = async (
    originalPath: string,
    stagedPaths: StagedPath[],
  ): Promise<void> => {
    const stagedPath = `${originalPath}.deleting-${randomUUID()}`;
    await rename(originalPath, stagedPath);
    stagedPaths.push({ originalPath, stagedPath });
  };

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
