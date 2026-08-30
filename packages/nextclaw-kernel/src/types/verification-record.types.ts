import type { PortableRuntimeAcceptanceEvidenceSource } from "@kernel/types/portable-runtime-acceptance.types.js";

export type VerificationRecordStatus =
  | "passed"
  | "failed"
  | "blocked"
  | "not-supported"
  | "not-run";

export type VerificationRecordRole = "panel" | "agent" | "cli" | "system";

export type VerificationRecordEntrySurface =
  | "panel"
  | "agent"
  | "installed-app-cli"
  | "system";

export type VerificationRecordObservation = {
  durationMs?: number;
  runnerPid?: number | null;
  memory?: { rssBytes: number | null; pssBytes: number | null } | null;
};

export type VerificationRecordError = {
  code?: string;
  message: string;
};

/**
 * Immutable, redacted evidence emitted by a real Kernel invocation.
 * Inputs and outputs are represented by digests only; callers must never use
 * this record as a storage channel for user content or secrets.
 */
export type VerificationRecord = {
  evidenceSchemaVersion: 2;
  /** The producer that generated this versioned evidence. */
  evidenceSource: PortableRuntimeAcceptanceEvidenceSource;
  verificationRunId: string;
  acceptanceId: string;
  scenarioVersion: string;
  productVersion: string;
  runtimeVersion: string;
  implementationFingerprint: string;
  status: VerificationRecordStatus;
  startedAt: string;
  finishedAt: string;
  environment: string;
  appId: string;
  componentId: string;
  role: VerificationRecordRole;
  entrySurface: VerificationRecordEntrySurface;
  instanceId?: string;
  actionOrEvent: string;
  callId: string;
  traceId: string;
  capabilityDecisions: string[];
  inputDigest: string;
  outputDigest?: string;
  dataVersion: string;
  observation?: VerificationRecordObservation;
  error?: VerificationRecordError;
  recovery?: string;
  evidenceRefs: string[];
};

/**
 * Historical records are retained for audit but can never satisfy the current
 * acceptance contract because they predate version/fingerprint evidence.
 */
export type LegacyVerificationRecord = Omit<
  VerificationRecord,
  | "evidenceSchemaVersion"
  | "productVersion"
  | "runtimeVersion"
  | "implementationFingerprint"
  | "evidenceSource"
> & { evidenceSchemaVersion: 1 };

export type VerificationEvidenceRecord = VerificationRecord | LegacyVerificationRecord;

export type VerificationRecordInput =
  | (Omit<VerificationRecord, "evidenceSchemaVersion" | "verificationRunId"> & {
    verificationRunId?: string;
  })
  | (Omit<LegacyVerificationRecord, "evidenceSchemaVersion" | "verificationRunId"> & {
    verificationRunId?: string;
  });

export type VerificationRecordList = {
  entries: VerificationEvidenceRecord[];
};
