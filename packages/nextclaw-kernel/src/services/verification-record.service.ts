import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  LegacyVerificationRecord,
  VerificationEvidenceRecord,
  VerificationRecord,
  VerificationRecordInput,
  VerificationRecordList,
} from "@kernel/types/verification-record.types.js";
import type { PortableRuntimeAcceptanceEvidenceSource } from "@kernel/types/portable-runtime-acceptance.types.js";
import type { PortableRuntimeAcceptanceEvaluationContext } from "@kernel/utils/portable-runtime-acceptance-evaluator.utils.js";

const MAX_RETAINED_RECORDS = 500;

type VerificationRecordStore = {
  schemaVersion: 2;
  entries: VerificationEvidenceRecord[];
};

/** Owns durable, redacted evidence. Product surfaces can only read/export it. */
export class VerificationRecordService {
  private loadPromise: Promise<void> | undefined;
  private readonly entries = new Map<string, VerificationEvidenceRecord>();
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly params: {
    storePath: string;
    /**
     * The Kernel-owned current runtime identity. Generic invocation evidence
     * obtains its versioned local provenance here; callers never manufacture
     * a fingerprint from their own observations.
     */
    resolveCurrentIdentity?: (appId: string) => Promise<PortableRuntimeAcceptanceEvaluationContext | undefined>;
  }) {}

  record = async (input: VerificationRecordInput): Promise<VerificationEvidenceRecord> => {
    await this.ensureLoaded();
    const candidate = {
      ...input,
      verificationRunId: input.verificationRunId ?? randomUUID(),
      capabilityDecisions: [...input.capabilityDecisions],
      evidenceRefs: [...input.evidenceRefs],
      observation: input.observation ? { ...input.observation } : undefined,
    };
    const record = this.normalizeInput(await this.withCurrentIdentity(candidate));
    await this.mutate(() => {
      this.entries.set(record.verificationRunId, record);
      this.trim();
    });
    return this.clone(record);
  };

  list = async (filters: {
    acceptanceId?: string;
    appId?: string;
    limit?: number;
  } = {}): Promise<VerificationRecordList> => {
    await this.ensureLoaded();
    const limit = Number.isInteger(filters.limit) && (filters.limit ?? 0) > 0
      ? Math.min(filters.limit as number, MAX_RETAINED_RECORDS)
      : MAX_RETAINED_RECORDS;
    return {
      entries: [...this.entries.values()]
        .filter((record) => !filters.acceptanceId || record.acceptanceId === filters.acceptanceId)
        .filter((record) => !filters.appId || record.appId === filters.appId)
        .sort((left, right) => right.finishedAt.localeCompare(left.finishedAt))
        .slice(0, limit)
        .map((record) => this.clone(record)),
    };
  };

  export = async (filters: Parameters<VerificationRecordService["list"]>[0] = {}): Promise<string> =>
    `${JSON.stringify(await this.list(filters), null, 2)}\n`;

  private ensureLoaded = async (): Promise<void> => {
    this.loadPromise ??= this.load();
    await this.loadPromise;
  };

  private load = async (): Promise<void> => {
    try {
      const parsed = JSON.parse(await readFile(this.params.storePath, "utf8")) as unknown;
      const store = this.parseStore(parsed);
      for (const entry of store.entries) {
        this.entries.set(entry.verificationRunId, entry);
      }
      this.trim();
    } catch (error) {
      if (!this.isMissing(error)) throw error;
    }
  };

  private mutate = async (operation: () => void): Promise<void> => {
    const current = this.mutationQueue.catch(() => undefined).then(async () => {
      operation();
      await this.save();
    });
    this.mutationQueue = current;
    await current;
  };

  private save = async (): Promise<void> => {
    const directory = path.dirname(this.params.storePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const staged = `${this.params.storePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(staged, `${JSON.stringify({
      schemaVersion: 2,
      entries: [...this.entries.values()],
    } satisfies VerificationRecordStore, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(staged, this.params.storePath);
    await chmod(this.params.storePath, 0o600);
  };

  private trim = (): void => {
    const retained = [...this.entries.values()]
      .sort((left, right) => right.finishedAt.localeCompare(left.finishedAt))
      .slice(0, MAX_RETAINED_RECORDS);
    this.entries.clear();
    for (const entry of retained) this.entries.set(entry.verificationRunId, entry);
  };

  private clone = (record: VerificationEvidenceRecord): VerificationEvidenceRecord => ({
    ...record,
    capabilityDecisions: [...record.capabilityDecisions],
    evidenceRefs: [...record.evidenceRefs],
    observation: record.observation ? { ...record.observation } : undefined,
  });

  private parseStore = (value: unknown): VerificationRecordStore => {
    if (!value || typeof value !== "object" || !Array.isArray((value as { entries?: unknown }).entries)) {
      throw new Error("Verification record store is not a structured evidence artifact.");
    }
    const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
    if (schemaVersion !== 1 && schemaVersion !== 2) {
      throw new Error("Verification record store has an unsupported schema version.");
    }
    return {
      schemaVersion: 2,
      entries: (value as { entries: unknown[] }).entries.map((entry) =>
        schemaVersion === 1 ? this.normalizeLegacyRecord(entry) : this.normalizeStoredRecord(entry)),
    };
  };

  private normalizeInput = (value: VerificationRecordInput & { verificationRunId: string }): VerificationEvidenceRecord => {
    const currentIdentity = value as Partial<VerificationRecord>;
    const hasCurrentIdentity = [
      currentIdentity.productVersion,
      currentIdentity.runtimeVersion,
      currentIdentity.implementationFingerprint,
      currentIdentity.evidenceSource,
    ].every((field) => typeof field === "string");
    const hasAnyCurrentIdentity = [
      currentIdentity.productVersion,
      currentIdentity.runtimeVersion,
      currentIdentity.implementationFingerprint,
      currentIdentity.evidenceSource,
    ].some((field) => field !== undefined);
    if (hasAnyCurrentIdentity && !hasCurrentIdentity) {
      throw new Error("Verification records must include productVersion, runtimeVersion, implementationFingerprint, and evidence source together.");
    }
    return hasCurrentIdentity
      ? this.normalizeCurrentRecord({ ...value, evidenceSchemaVersion: 2 })
      : this.normalizeLegacyRecord(value);
  };

  private withCurrentIdentity = async (
    value: VerificationRecordInput & { verificationRunId: string },
  ): Promise<VerificationRecordInput & { verificationRunId: string }> => {
    const current = value as Partial<VerificationRecord>;
    const hasAnyCurrentIdentity = [
      current.productVersion,
      current.runtimeVersion,
      current.implementationFingerprint,
      current.evidenceSource,
    ].some((field) => field !== undefined);
    if (hasAnyCurrentIdentity || !this.params.resolveCurrentIdentity) return value;
    const identity = await this.params.resolveCurrentIdentity(value.appId);
    return identity ? {
      ...value,
      evidenceSource: "local",
      productVersion: identity.productVersion,
      runtimeVersion: identity.runtimeVersion,
      implementationFingerprint: identity.implementationFingerprint,
    } : value;
  };

  private normalizeStoredRecord = (value: unknown): VerificationEvidenceRecord => {
    if (!value || typeof value !== "object") throw new Error("Verification record must be an object.");
    const schemaVersion = (value as { evidenceSchemaVersion?: unknown }).evidenceSchemaVersion;
    if (schemaVersion === 1) return this.normalizeLegacyRecord(value);
    if (schemaVersion === 2) return this.normalizeCurrentRecord(value);
    throw new Error("Verification record has an unsupported evidence schema version.");
  };

  private normalizeCurrentRecord = (value: unknown): VerificationRecord => {
    const record = this.normalizeBaseRecord(value);
    if ((value as { evidenceSchemaVersion?: unknown }).evidenceSchemaVersion !== 2 ||
      !this.isNonEmptyString((value as { productVersion?: unknown }).productVersion) ||
      !this.isNonEmptyString((value as { runtimeVersion?: unknown }).runtimeVersion) ||
      !this.isNonEmptyString((value as { implementationFingerprint?: unknown }).implementationFingerprint) ||
      !this.isEvidenceSource((value as { evidenceSource?: unknown }).evidenceSource)) {
      throw new Error("Current verification record is missing version, implementation fingerprint, or evidence source.");
    }
    return {
      ...record,
      evidenceSchemaVersion: 2,
      productVersion: (value as { productVersion: string }).productVersion,
      runtimeVersion: (value as { runtimeVersion: string }).runtimeVersion,
      implementationFingerprint: (value as { implementationFingerprint: string }).implementationFingerprint,
      evidenceSource: (value as { evidenceSource: PortableRuntimeAcceptanceEvidenceSource }).evidenceSource,
    };
  };

  private normalizeLegacyRecord = (value: unknown): LegacyVerificationRecord => ({
    ...this.normalizeBaseRecord(value),
    evidenceSchemaVersion: 1,
  });

  private normalizeBaseRecord = (value: unknown): Omit<LegacyVerificationRecord, "evidenceSchemaVersion"> => {
    if (!value || typeof value !== "object") throw new Error("Verification record must be an object.");
    const record = value as Record<string, unknown>;
    const stringFields = ["verificationRunId", "acceptanceId", "scenarioVersion", "startedAt", "finishedAt", "environment", "appId", "componentId", "role", "entrySurface", "actionOrEvent", "callId", "traceId", "inputDigest", "dataVersion"] as const;
    if (stringFields.some((field) => !this.isNonEmptyString(record[field])) ||
      !["passed", "failed", "blocked", "not-supported", "not-run"].includes(record.status as string) ||
      !["panel", "agent", "cli", "system"].includes(record.role as string) ||
      !["panel", "agent", "installed-app-cli", "system"].includes(record.entrySurface as string) ||
      !Array.isArray(record.capabilityDecisions) || !record.capabilityDecisions.every((entry) => typeof entry === "string") ||
      !Array.isArray(record.evidenceRefs) || !record.evidenceRefs.every((entry) => typeof entry === "string") ||
      Number.isNaN(Date.parse(record.startedAt as string)) || Number.isNaN(Date.parse(record.finishedAt as string))) {
      throw new Error("Verification record has invalid required evidence fields.");
    }
    if (record.instanceId !== undefined && !this.isNonEmptyString(record.instanceId) ||
      record.outputDigest !== undefined && !this.isNonEmptyString(record.outputDigest) ||
      record.recovery !== undefined && !this.isNonEmptyString(record.recovery) ||
      record.observation !== undefined && !this.isObservation(record.observation) ||
      record.error !== undefined && !this.isError(record.error)) {
      throw new Error("Verification record has invalid optional evidence fields.");
    }
    return {
      verificationRunId: record.verificationRunId as string,
      acceptanceId: record.acceptanceId as string,
      scenarioVersion: record.scenarioVersion as string,
      status: record.status as VerificationRecord["status"],
      startedAt: record.startedAt as string,
      finishedAt: record.finishedAt as string,
      environment: record.environment as string,
      appId: record.appId as string,
      componentId: record.componentId as string,
      role: record.role as VerificationRecord["role"],
      entrySurface: record.entrySurface as VerificationRecord["entrySurface"],
      ...(record.instanceId ? { instanceId: record.instanceId as string } : {}),
      actionOrEvent: record.actionOrEvent as string,
      callId: record.callId as string,
      traceId: record.traceId as string,
      capabilityDecisions: [...record.capabilityDecisions] as string[],
      inputDigest: record.inputDigest as string,
      ...(record.outputDigest ? { outputDigest: record.outputDigest as string } : {}),
      dataVersion: record.dataVersion as string,
      observation: record.observation as VerificationRecord["observation"],
      error: record.error as VerificationRecord["error"],
      ...(record.recovery ? { recovery: record.recovery as string } : {}),
      evidenceRefs: [...record.evidenceRefs] as string[],
    };
  };

  private isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

  private isEvidenceSource = (value: unknown): value is PortableRuntimeAcceptanceEvidenceSource =>
    value === "local" || value === "ci" || value === "release";

  private isObservation = (value: unknown): boolean => Boolean(value) && typeof value === "object" &&
    ((value as { durationMs?: unknown }).durationMs === undefined || typeof (value as { durationMs?: unknown }).durationMs === "number") &&
    ((value as { runnerPid?: unknown }).runnerPid === undefined || typeof (value as { runnerPid?: unknown }).runnerPid === "number" || (value as { runnerPid?: unknown }).runnerPid === null) &&
    ((value as { memory?: unknown }).memory === undefined || (value as { memory?: unknown }).memory === null || this.isMemory((value as { memory?: unknown }).memory));

  private isMemory = (value: unknown): boolean => Boolean(value) && typeof value === "object" &&
    ["rssBytes", "pssBytes"].every((field) => {
      const entry = (value as Record<string, unknown>)[field];
      return typeof entry === "number" || entry === null;
    });

  private isError = (value: unknown): boolean => Boolean(value) && typeof value === "object" &&
    this.isNonEmptyString((value as { message?: unknown }).message) &&
    ((value as { code?: unknown }).code === undefined || typeof (value as { code?: unknown }).code === "string");

  private isMissing = (error: unknown): boolean =>
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT";
}
