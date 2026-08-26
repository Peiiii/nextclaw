import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

type LocalExecutionClaimState = "active" | "completed";

export type LocalExecutionClaimRecord<TCompletion = unknown> = {
  version: 1;
  claimId: string;
  key: string;
  pid: number;
  createdAtMs: number;
  state: LocalExecutionClaimState;
  completion?: TCompletion;
};

export type LocalExecutionClaimHandle<TCompletion = unknown> = {
  readonly claimId: string;
  readonly key: string;
  complete(completion: TCompletion): void;
  release(): void;
};

export type LocalExecutionClaimAcquireResult<TCompletion = unknown> =
  | {
      acquired: true;
      claim: LocalExecutionClaimHandle<TCompletion>;
    }
  | {
      acquired: false;
      reason: "active-owner" | "completed";
      record: LocalExecutionClaimRecord<TCompletion> | null;
    };

export type LocalExecutionClaimServiceOptions = {
  incompleteClaimGraceMs?: number;
  isProcessAlive?: (pid: number) => boolean;
  nowMs?: () => number;
  pid?: number;
};

const DEFAULT_INCOMPLETE_CLAIM_GRACE_MS = 5_000;
const MAX_ACQUIRE_ATTEMPTS = 4;

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function isClaimRecord<TCompletion>(
  value: unknown,
  expectedKey: string,
): value is LocalExecutionClaimRecord<TCompletion> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Partial<LocalExecutionClaimRecord<TCompletion>>;
  return record.version === 1
    && typeof record.claimId === "string"
    && record.claimId.length > 0
    && record.key === expectedKey
    && Number.isInteger(record.pid)
    && (record.pid ?? 0) > 0
    && typeof record.createdAtMs === "number"
    && Number.isFinite(record.createdAtMs)
    && (record.state === "active" || record.state === "completed");
}

export class LocalExecutionClaimService {
  private readonly incompleteClaimGraceMs: number;
  private readonly processIsAlive: (pid: number) => boolean;
  private readonly now: () => number;
  private readonly pid: number;

  constructor(
    private readonly rootDirectory: string,
    options: LocalExecutionClaimServiceOptions = {},
  ) {
    this.incompleteClaimGraceMs = Math.max(
      0,
      options.incompleteClaimGraceMs ?? DEFAULT_INCOMPLETE_CLAIM_GRACE_MS,
    );
    this.processIsAlive = options.isProcessAlive ?? isProcessAlive;
    this.now = options.nowMs ?? Date.now;
    this.pid = options.pid ?? process.pid;
  }

  tryAcquire = <TCompletion = unknown>(
    key: string,
  ): LocalExecutionClaimAcquireResult<TCompletion> => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      throw new Error("Local execution claim key is required.");
    }
    mkdirSync(this.rootDirectory, { recursive: true });
    const claimPath = this.resolveClaimPath(normalizedKey);

    for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt += 1) {
      const claimId = randomUUID();
      const record: LocalExecutionClaimRecord<TCompletion> = {
        version: 1,
        claimId,
        key: normalizedKey,
        pid: this.pid,
        createdAtMs: this.now(),
        state: "active",
      };
      try {
        const descriptor = openSync(claimPath, "wx", 0o600);
        try {
          writeFileSync(descriptor, JSON.stringify(record));
        } finally {
          closeSync(descriptor);
        }
        return {
          acquired: true,
          claim: this.createHandle<TCompletion>(claimPath, record),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          throw error;
        }
      }

      const existing = this.readClaim<TCompletion>(claimPath, normalizedKey);
      if (existing?.state === "completed") {
        return { acquired: false, reason: "completed", record: existing };
      }
      if (existing?.state === "active" && this.processIsAlive(existing.pid)) {
        return { acquired: false, reason: "active-owner", record: existing };
      }
      if (!existing && !this.isIncompleteClaimStale(claimPath)) {
        return { acquired: false, reason: "active-owner", record: null };
      }
      if (!this.moveStaleClaimAside(claimPath)) {
        continue;
      }
    }

    throw new Error(`Unable to acquire local execution claim after contention: ${normalizedKey}`);
  };

  private createHandle = <TCompletion>(
    claimPath: string,
    record: LocalExecutionClaimRecord<TCompletion>,
  ): LocalExecutionClaimHandle<TCompletion> => ({
    claimId: record.claimId,
    key: record.key,
    complete: (completion) => {
      const current = this.assertOwnedClaim<TCompletion>(claimPath, record);
      writeFileSync(claimPath, JSON.stringify({
        ...current,
        state: "completed",
        completion,
      } satisfies LocalExecutionClaimRecord<TCompletion>));
    },
    release: () => {
      this.assertOwnedClaim<TCompletion>(claimPath, record);
      unlinkSync(claimPath);
    },
  });

  private assertOwnedClaim = <TCompletion>(
    claimPath: string,
    expected: LocalExecutionClaimRecord<TCompletion>,
  ): LocalExecutionClaimRecord<TCompletion> => {
    const current = this.readClaim<TCompletion>(claimPath, expected.key);
    if (!current || current.claimId !== expected.claimId) {
      throw new Error(`Local execution claim is no longer owned: ${expected.key}`);
    }
    return current;
  };

  private readClaim = <TCompletion>(
    claimPath: string,
    key: string,
  ): LocalExecutionClaimRecord<TCompletion> | null => {
    try {
      const value: unknown = JSON.parse(readFileSync(claimPath, "utf8"));
      return isClaimRecord<TCompletion>(value, key) ? value : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      return null;
    }
  };

  private isIncompleteClaimStale = (claimPath: string): boolean => {
    try {
      return this.now() - statSync(claimPath).mtimeMs >= this.incompleteClaimGraceMs;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ENOENT";
    }
  };

  private moveStaleClaimAside = (claimPath: string): boolean => {
    const stalePath = `${claimPath}.stale-${randomUUID()}`;
    try {
      renameSync(claimPath, stalePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
    if (existsSync(stalePath)) {
      unlinkSync(stalePath);
    }
    return true;
  };

  private resolveClaimPath = (key: string): string =>
    join(this.rootDirectory, `${createHash("sha256").update(key).digest("hex")}.claim`);
}
