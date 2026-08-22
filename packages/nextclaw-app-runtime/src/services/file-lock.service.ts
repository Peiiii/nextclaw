import { randomUUID } from "node:crypto";
import { access, mkdir, open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

type FileLockMetadata = {
  token: string;
  pid: number;
  createdAt: string;
};

export class FileLockBusyError extends Error {
  readonly lockPath: string;

  constructor(lockPath: string) {
    super(`等待文件锁超时：${lockPath}`);
    this.name = "FileLockBusyError";
    this.lockPath = lockPath;
  }
}

export type FileLockLease = {
  release(): Promise<void>;
};

const DEFAULT_WAIT_TIMEOUT_MS = 15_000;
const MALFORMED_LOCK_STALE_AFTER_MS = 30_000;
const RETRY_DELAY_MS = 25;

export class FileLockService {
  private static readonly localQueues = new Map<string, Promise<unknown>>();

  withLock = async <T>(
    lockPath: string,
    operation: () => Promise<T>,
    options: { waitTimeoutMs?: number } = {},
  ): Promise<T> => {
    const resolvedLockPath = path.resolve(lockPath);
    const previous = FileLockService.localQueues.get(resolvedLockPath) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(async () => {
      const release = await this.acquire(resolvedLockPath, options.waitTimeoutMs);
      try {
        return await operation();
      } finally {
        await release();
      }
    });
    FileLockService.localQueues.set(resolvedLockPath, current);
    try {
      return await current;
    } finally {
      if (FileLockService.localQueues.get(resolvedLockPath) === current) {
        FileLockService.localQueues.delete(resolvedLockPath);
      }
    }
  };

  acquireLease = async (
    lockPath: string,
    options: { waitTimeoutMs?: number } = {},
  ): Promise<FileLockLease> => ({
    release: await this.acquire(path.resolve(lockPath), options.waitTimeoutMs ?? 0),
  });

  private acquire = async (
    lockPath: string,
    waitTimeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
  ): Promise<() => Promise<void>> => {
    await mkdir(path.dirname(lockPath), { recursive: true });
    const startedAt = Date.now();
    const recoveryLockPath = `${lockPath}.recovery`;
    while (true) {
      if (await this.pathExists(recoveryLockPath)) {
        await this.waitOrThrow(lockPath, startedAt, waitTimeoutMs);
        continue;
      }
      const metadata: FileLockMetadata = {
        token: randomUUID(),
        pid: process.pid,
        createdAt: new Date().toISOString(),
      };
      try {
        const handle = await open(lockPath, "wx", 0o600);
        try {
          await handle.writeFile(`${JSON.stringify(metadata)}\n`, "utf8");
          await handle.sync();
        } catch (error) {
          await handle.close().catch(() => undefined);
          await rm(lockPath, { force: true }).catch(() => undefined);
          throw error;
        }
        return async () => {
          await handle.close();
          await this.removeOwnedLock(lockPath, metadata.token);
        };
      } catch (error) {
        if (!this.isAlreadyExistsError(error)) {
          throw error;
        }
        if (await this.canRecoverLock(lockPath)) {
          const recovered = await this.recoverAndAcquire(lockPath, recoveryLockPath);
          if (recovered) {
            return recovered;
          }
        }
        await this.waitOrThrow(lockPath, startedAt, waitTimeoutMs);
      }
    }
  };

  private recoverAndAcquire = async (
    lockPath: string,
    recoveryLockPath: string,
  ): Promise<(() => Promise<void>) | undefined> => {
    let recoveryHandle;
    try {
      recoveryHandle = await open(recoveryLockPath, "wx", 0o600);
      await recoveryHandle.writeFile(`${process.pid}\n`, "utf8");
      await recoveryHandle.sync();
    } catch (error) {
      await recoveryHandle?.close().catch(() => undefined);
      if (this.isAlreadyExistsError(error)) {
        return undefined;
      }
      throw error;
    }
    try {
      if (!await this.canRecoverLock(lockPath)) {
        return undefined;
      }
      await rm(lockPath, { force: true });
      const metadata: FileLockMetadata = {
        token: randomUUID(),
        pid: process.pid,
        createdAt: new Date().toISOString(),
      };
      const handle = await open(lockPath, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(metadata)}\n`, "utf8");
        await handle.sync();
      } catch (error) {
        await handle.close().catch(() => undefined);
        await rm(lockPath, { force: true }).catch(() => undefined);
        throw error;
      }
      return async () => {
        await handle.close();
        await this.removeOwnedLock(lockPath, metadata.token);
      };
    } finally {
      await recoveryHandle.close();
      await rm(recoveryLockPath, { force: true });
    }
  };

  private waitOrThrow = async (
    lockPath: string,
    startedAt: number,
    waitTimeoutMs: number,
  ): Promise<void> => {
    if (Date.now() - startedAt >= waitTimeoutMs) {
      throw new FileLockBusyError(lockPath);
    }
    await delay(RETRY_DELAY_MS + Math.floor(Math.random() * RETRY_DELAY_MS));
  };

  private removeOwnedLock = async (lockPath: string, token: string): Promise<void> => {
    try {
      const metadata = this.parseMetadata(await readFile(lockPath, "utf8"));
      if (metadata?.token !== token) {
        throw new Error(`文件锁 owner 已变化，拒绝删除：${lockPath}`);
      }
      await rm(lockPath);
    } catch (error) {
      if (!this.isMissingFileError(error)) {
        throw error;
      }
    }
  };

  private canRecoverLock = async (lockPath: string): Promise<boolean> => {
    try {
      const [raw, lockStats] = await Promise.all([
        readFile(lockPath, "utf8"),
        stat(lockPath),
      ]);
      const metadata = this.parseMetadata(raw);
      if (metadata) {
        return !this.isProcessAlive(metadata.pid);
      }
      return Date.now() - lockStats.mtimeMs >= MALFORMED_LOCK_STALE_AFTER_MS;
    } catch (error) {
      return this.isMissingFileError(error);
    }
  };

  private parseMetadata = (raw: string): FileLockMetadata | undefined => {
    try {
      const candidate = JSON.parse(raw) as Partial<FileLockMetadata>;
      if (
        typeof candidate.token !== "string" ||
        !candidate.token ||
        typeof candidate.pid !== "number" ||
        !Number.isSafeInteger(candidate.pid) ||
        candidate.pid <= 0 ||
        typeof candidate.createdAt !== "string"
      ) {
        return undefined;
      }
      return candidate as FileLockMetadata;
    } catch {
      return undefined;
    }
  };

  private isProcessAlive = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return typeof error === "object" && error !== null &&
        "code" in error && (error as { code?: unknown }).code === "EPERM";
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

  private isAlreadyExistsError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "EEXIST";

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
