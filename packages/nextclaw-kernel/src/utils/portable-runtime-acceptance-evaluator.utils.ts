import {
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT,
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
  type PortableRuntimeAcceptanceDefinition,
  type PortableRuntimeAcceptanceEvidenceSource,
  type PortableRuntimeAcceptancePlatform,
} from "@kernel/types/portable-runtime-acceptance.types.js";
import type { VerificationEvidenceRecord } from "@kernel/types/verification-record.types.js";

export type PortableRuntimeAcceptanceEvaluationContext = {
  appId: string;
  environment: PortableRuntimeAcceptancePlatform;
  productVersion: string;
  runtimeVersion: string;
  implementationFingerprint: string;
  contractFingerprint: string;
};

export type PortableRuntimeAcceptanceEvidence = {
  source: PortableRuntimeAcceptanceEvidenceSource;
  records: VerificationEvidenceRecord[];
};

export type PortableRuntimeAcceptanceEvidenceArtifact = {
  schemaVersion: 1;
  contractFingerprint: string;
  targets: Array<PortableRuntimeAcceptanceEvaluationContext & {
    evidence: PortableRuntimeAcceptanceEvidence[];
  }>;
};

export type PortableRuntimeAcceptanceResultStatus =
  | "current-passed"
  | "missing"
  | "stale"
  | "failed"
  | "not-applicable";

export type PortableRuntimeAcceptanceResult = {
  acceptanceId: string;
  required: boolean;
  environment: PortableRuntimeAcceptancePlatform;
  status: PortableRuntimeAcceptanceResultStatus;
  latestRecord?: VerificationEvidenceRecord;
};

export function evaluatePortableRuntimeAcceptance(input: {
  context: PortableRuntimeAcceptanceEvaluationContext;
  evidence: readonly PortableRuntimeAcceptanceEvidence[];
  definitions?: readonly PortableRuntimeAcceptanceDefinition[];
}): PortableRuntimeAcceptanceResult[] {
  const definitions = input.definitions ?? PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT;
  return definitions.map((definition) => evaluateDefinition(definition, input));
}

export function evaluatePortableRuntimeAcceptanceArtifact(
  artifact: PortableRuntimeAcceptanceEvidenceArtifact,
): PortableRuntimeAcceptanceResult[] {
  return artifact.targets.flatMap((target) => evaluatePortableRuntimeAcceptance({
    context: target,
    evidence: target.evidence,
  }));
}

export function parsePortableRuntimeAcceptanceEvidenceArtifact(
  value: unknown,
): PortableRuntimeAcceptanceEvidenceArtifact {
  if (!value || typeof value !== "object") throw new Error("Acceptance evidence artifact must be an object.");
  const artifact = value as Record<string, unknown>;
  if (artifact.schemaVersion !== 1 || typeof artifact.contractFingerprint !== "string" ||
    !Array.isArray(artifact.targets) || artifact.targets.length === 0) {
    throw new Error("Acceptance evidence artifact has an invalid envelope.");
  }
  const targets = artifact.targets.map((target) => parseTarget(target));
  return {
    schemaVersion: 1,
    contractFingerprint: artifact.contractFingerprint,
    targets,
  };
}

export const isCurrentPortableRuntimeAcceptanceContract = (
  fingerprint: string,
): boolean => fingerprint === PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT;

function evaluateDefinition(
  definition: PortableRuntimeAcceptanceDefinition,
  input: {
    context: PortableRuntimeAcceptanceEvaluationContext;
    evidence: readonly PortableRuntimeAcceptanceEvidence[];
  },
): PortableRuntimeAcceptanceResult {
  const base = {
    acceptanceId: definition.id,
    required: definition.required,
    environment: input.context.environment,
  } as const;
  if (!definition.platforms.includes(input.context.environment)) {
    return { ...base, status: "not-applicable" };
  }
  const source = input.evidence.find((entry) => entry.source === definition.evidenceSource);
  const records = source?.records.filter((record) => record.acceptanceId === definition.id) ?? [];
  if (records.length === 0) return { ...base, status: "missing" };
  if (!isCurrentPortableRuntimeAcceptanceContract(input.context.contractFingerprint)) {
    return { ...base, status: "stale", latestRecord: latest(records) };
  }
  const current = records.filter((record) => record.evidenceSchemaVersion === 2 &&
    record.scenarioVersion === definition.scenarioVersion &&
    record.productVersion === input.context.productVersion &&
    record.runtimeVersion === input.context.runtimeVersion &&
    record.implementationFingerprint === input.context.implementationFingerprint &&
    record.appId === input.context.appId &&
    record.environment === input.context.environment);
  if (current.length === 0) return { ...base, status: "stale", latestRecord: latest(records) };
  const latestRecord = latest(current);
  return {
    ...base,
    latestRecord,
    status: latestRecord.status === "passed" ? "current-passed" : "failed",
  };
}

function latest(records: readonly VerificationEvidenceRecord[]): VerificationEvidenceRecord {
  return [...records].sort((left, right) =>
    right.finishedAt.localeCompare(left.finishedAt) ||
    right.verificationRunId.localeCompare(left.verificationRunId),
  )[0]!;
}

function parseTarget(value: unknown): PortableRuntimeAcceptanceEvidenceArtifact["targets"][number] {
  if (!value || typeof value !== "object") throw new Error("Acceptance evidence target must be an object.");
  const target = value as Record<string, unknown>;
  const required = ["appId", "environment", "productVersion", "runtimeVersion", "implementationFingerprint", "contractFingerprint"] as const;
  if (required.some((field) => typeof target[field] !== "string" || target[field].length === 0) ||
    !isPlatform(target.environment) || !Array.isArray(target.evidence)) {
    throw new Error("Acceptance evidence target is incomplete.");
  }
  return {
    appId: target.appId as string,
    environment: target.environment,
    productVersion: target.productVersion as string,
    runtimeVersion: target.runtimeVersion as string,
    implementationFingerprint: target.implementationFingerprint as string,
    contractFingerprint: target.contractFingerprint as string,
    evidence: target.evidence.map((entry) => parseEvidence(entry)),
  };
}

function parseEvidence(value: unknown): PortableRuntimeAcceptanceEvidence {
  if (!value || typeof value !== "object") throw new Error("Acceptance evidence source must be an object.");
  const evidence = value as Record<string, unknown>;
  if (!isEvidenceSource(evidence.source) || !Array.isArray(evidence.records)) {
    throw new Error("Acceptance evidence source is invalid.");
  }
  // The Kernel service strictly validates persisted record fields. The release
  // boundary additionally rejects unversioned ad-hoc JSON instead of treating it as green evidence.
  if (evidence.records.some((record) => !isStructuredRecord(record))) {
    throw new Error("Acceptance evidence contains an invalid verification record.");
  }
  return { source: evidence.source, records: evidence.records as VerificationEvidenceRecord[] };
}

function isStructuredRecord(value: unknown): value is VerificationEvidenceRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const stringFields = [
    "verificationRunId", "acceptanceId", "scenarioVersion", "startedAt", "finishedAt", "environment",
    "appId", "componentId", "role", "entrySurface", "actionOrEvent", "callId", "traceId",
    "inputDigest", "dataVersion",
  ];
  return (record.evidenceSchemaVersion === 1 || record.evidenceSchemaVersion === 2) &&
    stringFields.every((field) => typeof record[field] === "string" && record[field].length > 0) &&
    ["passed", "failed", "blocked", "not-supported", "not-run"].includes(record.status as string) &&
    ["panel", "agent", "cli", "system"].includes(record.role as string) &&
    ["panel", "agent", "installed-app-cli", "system"].includes(record.entrySurface as string) &&
    Array.isArray(record.capabilityDecisions) && record.capabilityDecisions.every((entry) => typeof entry === "string") &&
    Array.isArray(record.evidenceRefs) && record.evidenceRefs.every((entry) => typeof entry === "string") &&
    !Number.isNaN(Date.parse(record.startedAt as string)) && !Number.isNaN(Date.parse(record.finishedAt as string)) &&
    (record.evidenceSchemaVersion !== 2 ||
      typeof record.productVersion === "string" && typeof record.runtimeVersion === "string" &&
      typeof record.implementationFingerprint === "string" && isEvidenceSource(record.evidenceSource));
}

function isEvidenceSource(value: unknown): value is PortableRuntimeAcceptanceEvidenceSource {
  return value === "local" || value === "ci" || value === "release";
}

function isPlatform(value: unknown): value is PortableRuntimeAcceptancePlatform {
  return value === "darwin-arm64" || value === "windows-x64" || value === "linux-x64";
}
