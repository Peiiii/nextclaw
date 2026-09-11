import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const MANIFEST_VERSION = 1;
const DEFAULT_MANIFEST_TTL_MS = 5 * 60 * 1000;

export type PlannedRestartRecoveryTicket = {
  operationId: string;
};

export type PlannedRestartRecoveryResult = {
  status: "none" | "mismatch" | "expired" | "invalid" | "recovered" | "error";
  operationId?: string;
  resumed: number;
  skipped: number;
  failed: number;
};

export type PlannedRestartRecovery = Pick<
  PlannedRestartRecoveryManager,
  "prepare" | "abort" | "recover" | "recoverFromSupervisor"
>;

type ActiveRun = {
  sessionId: string;
  runId: string;
};

type PlannedRestartManifest = {
  version: 1;
  operationId: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  runs: Array<{
    sessionId: string;
    sourceRunId: string;
  }>;
};

type PlannedRestartRecoveryManagerOptions = {
  manifestPath: string;
  listActiveRuns: () => readonly ActiveRun[];
  flushSessionEvents: () => Promise<void>;
  suspendAdmissions: () => Promise<void>;
  resumeAdmissions: () => void;
  continueRun: (params: {
    operationId: string;
    sessionId: string;
    sourceRunId: string;
    triggeredAt: string;
  }) => Promise<boolean>;
  now?: () => Date;
  manifestTtlMs?: number;
};

type ManifestReadResult =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "ok"; manifest: PlannedRestartManifest };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRequiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseManifest(value: unknown): PlannedRestartManifest | null {
  if (!isRecord(value) || value.version !== MANIFEST_VERSION || !Array.isArray(value.runs)) {
    return null;
  }
  const operationId = readRequiredString(value.operationId);
  const reason = readRequiredString(value.reason);
  const createdAt = readRequiredString(value.createdAt);
  const expiresAt = readRequiredString(value.expiresAt);
  if (
    !operationId ||
    !reason ||
    !createdAt ||
    !expiresAt ||
    !Number.isFinite(Date.parse(createdAt)) ||
    !Number.isFinite(Date.parse(expiresAt))
  ) {
    return null;
  }
  const runs: PlannedRestartManifest["runs"] = [];
  const seenSessions = new Set<string>();
  for (const candidate of value.runs) {
    if (!isRecord(candidate)) return null;
    const sessionId = readRequiredString(candidate.sessionId);
    const sourceRunId = readRequiredString(candidate.sourceRunId);
    if (!sessionId || !sourceRunId) return null;
    if (seenSessions.has(sessionId)) continue;
    seenSessions.add(sessionId);
    runs.push({ sessionId, sourceRunId });
  }
  return {
    version: MANIFEST_VERSION,
    operationId,
    reason,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    runs,
  };
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

export class PlannedRestartRecoveryManager {
  private readonly now: () => Date;
  private readonly manifestTtlMs: number;
  private preparedOperationId: string | null = null;
  private preparation: Promise<PlannedRestartRecoveryTicket> | null = null;

  constructor(private readonly options: PlannedRestartRecoveryManagerOptions) {
    this.now = options.now ?? (() => new Date());
    this.manifestTtlMs = options.manifestTtlMs ?? DEFAULT_MANIFEST_TTL_MS;
  }

  prepare = (reason: string): Promise<PlannedRestartRecoveryTicket> => {
    if (this.preparation) return this.preparation;
    this.preparation = this.prepareOnce(reason).finally(() => {
      this.preparation = null;
    });
    return this.preparation;
  };

  private prepareOnce = async (reason: string): Promise<PlannedRestartRecoveryTicket> => {
    if (this.preparedOperationId) {
      return { operationId: this.preparedOperationId };
    }

    try {
      await this.options.suspendAdmissions();
      const operationId = randomUUID();
      const createdAt = this.now();
      const runs = this.options.listActiveRuns().map(({ runId, sessionId }) => ({
        sessionId,
        sourceRunId: runId,
      }));
      await this.options.flushSessionEvents();
      await this.writeManifest({
        version: MANIFEST_VERSION,
        operationId,
        reason: reason.trim() || "planned restart",
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + this.manifestTtlMs).toISOString(),
        runs,
      });
      this.preparedOperationId = operationId;
      return { operationId };
    } catch (error) {
      this.options.resumeAdmissions();
      throw error;
    }
  };

  abort = async (operationId: string): Promise<void> => {
    const normalizedOperationId = operationId.trim();
    if (!normalizedOperationId) return;
    const result = await this.readManifest();
    if (result.status === "ok" && result.manifest.operationId === normalizedOperationId) {
      await rm(this.options.manifestPath, { force: true });
    }
    if (this.preparedOperationId === normalizedOperationId) {
      this.preparedOperationId = null;
      this.options.resumeAdmissions();
    }
  };

  recover = async (
    requestedOperationId: string | undefined,
  ): Promise<PlannedRestartRecoveryResult> => {
    const operationId = requestedOperationId?.trim();
    if (!operationId) return this.result("none");

    try {
      const readResult = await this.readManifest();
      if (readResult.status === "missing") return this.result("none");
      if (readResult.status === "invalid") return this.result("invalid", operationId);
      const manifest = readResult.manifest;
      if (manifest.operationId !== operationId) {
        return this.result("mismatch", operationId);
      }
      if (Date.parse(manifest.expiresAt) <= this.now().getTime()) {
        await rm(this.options.manifestPath, { force: true });
        return this.result("expired", operationId);
      }

      const claimedPath = `${this.options.manifestPath}.${operationId}.claimed`;
      try {
        await rename(this.options.manifestPath, claimedPath);
      } catch (error) {
        if (isMissingFileError(error)) return this.result("none", operationId);
        throw error;
      }

      try {
        return await this.continueClaimedRuns(manifest);
      } finally {
        await rm(claimedPath, { force: true });
      }
    } catch (error) {
      console.error(`[planned-restart-recovery] failed to consume manifest: ${String(error)}`);
      return this.result("error", operationId);
    }
  };

  recoverFromSupervisor = async (): Promise<PlannedRestartRecoveryResult> => {
    try {
      const readResult = await this.readManifest();
      if (readResult.status === "missing") return this.result("none");
      if (readResult.status === "invalid") return this.result("invalid");
      return await this.recover(readResult.manifest.operationId);
    } catch (error) {
      console.error(`[planned-restart-recovery] failed to inspect supervisor manifest: ${String(error)}`);
      return this.result("error");
    }
  };

  private continueClaimedRuns = async (manifest: PlannedRestartManifest): Promise<PlannedRestartRecoveryResult> => {
    const result = this.result("recovered", manifest.operationId);
    for (const run of manifest.runs) {
      try {
        const accepted = await this.options.continueRun({
          ...run, operationId: manifest.operationId, triggeredAt: this.now().toISOString(),
        });
        if (accepted) result.resumed += 1;
        else result.skipped += 1;
      } catch (error) {
        result.failed += 1;
        console.error(`[planned-restart-recovery] failed to continue ${run.sessionId}: ${String(error)}`);
      }
    }
    return result;
  };

  private readManifest = async (): Promise<ManifestReadResult> => {
    let raw: string;
    try {
      raw = await readFile(this.options.manifestPath, "utf-8");
    } catch (error) {
      if (isMissingFileError(error)) return { status: "missing" };
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await rm(this.options.manifestPath, { force: true });
      return { status: "invalid" };
    }
    const manifest = parseManifest(parsed);
    if (!manifest) {
      await rm(this.options.manifestPath, { force: true });
      return { status: "invalid" };
    }
    return { status: "ok", manifest };
  };

  private writeManifest = async (manifest: PlannedRestartManifest): Promise<void> => {
    const directory = dirname(this.options.manifestPath);
    await mkdir(directory, { recursive: true });
    const temporaryPath = resolve(
      directory,
      `.${basename(this.options.manifestPath)}.${process.pid}.${randomUUID()}.tmp`,
    );
    const handle = await open(temporaryPath, "w", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporaryPath, this.options.manifestPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  };

  private result = (
    status: PlannedRestartRecoveryResult["status"],
    operationId?: string,
  ): PlannedRestartRecoveryResult => ({
    status,
    ...(operationId ? { operationId } : {}),
    resumed: 0,
    skipped: 0,
    failed: 0,
  });
}
