import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import type {
  AppPackageOperationInput,
  AppPackageOperationList,
  AppPackageOperationResult,
  AppPackageOperationStatus,
  AppPackageOperationView,
} from "@kernel/types/app-package.types.js";

const ACTIVE_STATUSES = new Set<AppPackageOperationStatus>([
  "queued",
  "resolving",
  "downloading",
  "verifying",
  "installing",
  "finalizing",
]);
const MAX_RETAINED_OPERATIONS = 60;

type StoredOperations = {
  schemaVersion: 1;
  entries: AppPackageOperationView[];
};

export class AppPackageOperationManager {
  private readonly entries = new Map<string, AppPackageOperationView>();
  private loadPromise: Promise<void> | undefined;
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly params: {
    storePath: string;
    execute: (
      input: AppPackageOperationInput,
      report: (status: AppPackageOperationStatus) => Promise<void>,
    ) => Promise<AppPackageOperationResult>;
  }) {}

  list = async (): Promise<AppPackageOperationList> => {
    await this.ensureLoaded();
    return {
      entries: [...this.entries.values()]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((entry) => ({ ...entry })),
    };
  };

  start = async (input: AppPackageOperationInput): Promise<AppPackageOperationView> => {
    await this.ensureLoaded();
    const now = new Date().toISOString();
    const operation: AppPackageOperationView = {
      id: randomUUID(),
      action: input.action,
      ...(input.action === "install"
        ? { source: input.source, appId: this.readRegistryAppId(input.source) }
        : { appId: input.appId }),
      ...(input.action === "rollback" || input.action === "update"
        ? { targetVersion: input.version }
        : {}),
      status: "queued",
      completedSteps: 0,
      totalSteps: 5,
      createdAt: now,
      updatedAt: now,
    };
    let acceptedOperation = operation;
    let created = false;
    await this.mutate(async () => {
      const operationKey = this.operationKey(input);
      const existing = [...this.entries.values()].find((entry) =>
        ACTIVE_STATUSES.has(entry.status) && this.viewOperationKey(entry) === operationKey,
      );
      if (existing) {
        acceptedOperation = existing;
        return;
      }
      this.entries.set(operation.id, operation);
      this.trimEntries();
      created = true;
    });
    if (created) {
      queueMicrotask(() => {
        void this.run(operation.id, input).catch(() => undefined);
      });
    }
    return { ...acceptedOperation };
  };

  private run = async (
    operationId: string,
    input: AppPackageOperationInput,
  ): Promise<void> => {
    const report = async (status: AppPackageOperationStatus): Promise<void> => {
      await this.update(operationId, {
        status,
        completedSteps: this.completedSteps(status),
      });
    };
    try {
      const result = await this.params.execute(input, report);
      await this.update(operationId, {
        appId: result.appId,
        completedAt: new Date().toISOString(),
        completedSteps: 5,
        result,
        status: "succeeded",
      });
    } catch (error) {
      await this.update(operationId, {
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        status: "failed",
      });
    }
  };

  private ensureLoaded = async (): Promise<void> => {
    this.loadPromise ??= this.load();
    await this.loadPromise;
  };

  private load = async (): Promise<void> => {
    let parsed: StoredOperations = { schemaVersion: 1, entries: [] };
    try {
      const candidate = JSON.parse(await readFile(this.params.storePath, "utf8")) as StoredOperations;
      if (candidate.schemaVersion === 1 && Array.isArray(candidate.entries)) {
        parsed = candidate;
      }
    } catch (error) {
      if (!this.isMissingFileError(error)) {
        throw error;
      }
    }
    let changed = false;
    for (const entry of parsed.entries.filter(this.isOperationView)) {
      if (ACTIVE_STATUSES.has(entry.status)) {
        const now = new Date().toISOString();
        this.entries.set(entry.id, {
          ...entry,
          status: "interrupted",
          completedAt: now,
          updatedAt: now,
          error: "NextClaw 在操作完成前退出，请重试。",
        });
        changed = true;
      } else {
        this.entries.set(entry.id, entry);
      }
    }
    this.trimEntries();
    if (changed) {
      await this.save();
    }
  };

  private update = async (
    operationId: string,
    patch: Partial<AppPackageOperationView>,
  ): Promise<void> => {
    await this.mutate(async () => {
      const current = this.entries.get(operationId);
      if (!current) {
        return;
      }
      this.entries.set(operationId, {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
    });
  };

  private mutate = async (operation: () => Promise<void>): Promise<void> => {
    const current = this.mutationQueue.catch(() => undefined).then(async () => {
      await operation();
      await this.save();
    });
    this.mutationQueue = current;
    await current;
  };

  private save = async (): Promise<void> => {
    const storeDirectory = path.dirname(this.params.storePath);
    await mkdir(storeDirectory, { recursive: true });
    const temporaryPath = path.join(
      storeDirectory,
      `.${path.basename(this.params.storePath)}.${process.pid}.${Date.now()}.tmp`,
    );
    const handle = await open(temporaryPath, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify({
        schemaVersion: 1,
        entries: [...this.entries.values()],
      } satisfies StoredOperations, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporaryPath, this.params.storePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  };

  private trimEntries = (): void => {
    const retained = [...this.entries.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, MAX_RETAINED_OPERATIONS);
    this.entries.clear();
    for (const entry of retained) {
      this.entries.set(entry.id, entry);
    }
  };

  private operationKey = (input: AppPackageOperationInput): string =>
    input.action === "install"
      ? this.readRegistryAppId(input.source)
        ? `app:${this.readRegistryAppId(input.source)}`
        : `install-source:${input.source}`
      : `app:${input.appId}`;

  private viewOperationKey = (operation: AppPackageOperationView): string =>
    operation.action === "install"
      ? operation.appId
        ? `app:${operation.appId}`
        : `install-source:${operation.source ?? ""}`
      : `app:${operation.appId ?? ""}`;

  private readRegistryAppId = (source: string): string | undefined => {
    const match = /^(?<appId>[a-z0-9][a-z0-9._-]*)(?:@[A-Za-z0-9._+-]+)?$/i.exec(source.trim());
    return match?.groups?.appId;
  };

  private completedSteps = (status: AppPackageOperationStatus): number => {
    switch (status) {
      case "queued": return 0;
      case "resolving": return 1;
      case "downloading": return 2;
      case "verifying": return 3;
      case "installing": return 4;
      case "finalizing": return 4;
      case "succeeded": return 5;
      case "failed":
      case "interrupted": return 0;
    }
  };

  private isOperationView = (value: unknown): value is AppPackageOperationView => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const candidate = value as Partial<AppPackageOperationView>;
    return typeof candidate.id === "string" &&
      typeof candidate.action === "string" &&
      typeof candidate.status === "string" &&
      typeof candidate.createdAt === "string" &&
      typeof candidate.updatedAt === "string";
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
