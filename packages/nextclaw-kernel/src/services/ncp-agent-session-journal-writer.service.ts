import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  FileLockBusyError,
  FileLockService,
  type FileLockLease,
} from "@nextclaw/app-runtime";

export class NcpAgentSessionJournalWriterConflictError extends Error {
  readonly journalDir: string;
  readonly ownerPid: number | null;

  constructor(journalDir: string, ownerPid: number | null = null, cause?: unknown) {
    super(
      `Another NextClaw runtime already owns the session journal: ${journalDir}` +
        (ownerPid ? ` (PID ${ownerPid})` : "") +
        ". Open the existing instance, or set NEXTCLAW_HOME to an isolated directory.",
      cause instanceof Error ? { cause } : undefined,
    );
    this.name = "NcpAgentSessionJournalWriterConflictError";
    this.journalDir = journalDir;
    this.ownerPid = ownerPid;
  }
}

export class NcpAgentSessionJournalWriterService {
  private readonly fileLockService = new FileLockService();
  private writerLease: FileLockLease | null = null;
  private writerLeasePromise: Promise<void> | null = null;

  constructor(private readonly journalDir: string) {}

  start = async (): Promise<void> => {
    if (this.writerLease) {
      return;
    }
    if (this.writerLeasePromise) {
      return await this.writerLeasePromise;
    }
    const acquire = (async () => {
      await this.assertNoLegacyWriter();
      try {
        this.writerLease = await this.fileLockService.acquireLease(
          join(this.journalDir, ".writer.lock"),
        );
      } catch (error) {
        if (error instanceof FileLockBusyError) {
          throw new NcpAgentSessionJournalWriterConflictError(
            this.journalDir,
            await this.readWriterOwnerPid() ?? await this.readLegacyOwnerPid(),
            error,
          );
        }
        throw error;
      }
    })();
    this.writerLeasePromise = acquire;
    try {
      await acquire;
    } finally {
      if (this.writerLeasePromise === acquire) {
        this.writerLeasePromise = null;
      }
    }
  };

  dispose = async (): Promise<void> => {
    const lease = this.writerLease;
    this.writerLease = null;
    await lease?.release();
  };

  private assertNoLegacyWriter = async (): Promise<void> => {
    const ownerPid = await this.readLegacyOwnerPid();
    if (ownerPid !== null && ownerPid !== process.pid) {
      throw new NcpAgentSessionJournalWriterConflictError(this.journalDir, ownerPid);
    }
  };

  private readLegacyOwnerPid = async (): Promise<number | null> => {
    const runDir = resolve(this.journalDir, "..", "..", "run");
    for (const fileName of ["service.json", "ui-runtime.json"]) {
      try {
        const parsed = JSON.parse(await readFile(join(runDir, fileName), "utf-8")) as {
          pid?: unknown;
        };
        const pid = typeof parsed.pid === "number" && Number.isSafeInteger(parsed.pid)
          ? parsed.pid
          : null;
        if (pid !== null && pid !== process.pid && this.isProcessAlive(pid)) {
          return pid;
        }
      } catch {
        // Missing or malformed legacy state cannot establish a live owner.
      }
    }
    return null;
  };

  private readWriterOwnerPid = async (): Promise<number | null> => {
    try {
      const parsed = JSON.parse(await readFile(join(this.journalDir, ".writer.lock"), "utf-8")) as {
        pid?: unknown;
      };
      return typeof parsed.pid === "number" && Number.isSafeInteger(parsed.pid)
        ? parsed.pid
        : null;
    } catch {
      return null;
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
}
