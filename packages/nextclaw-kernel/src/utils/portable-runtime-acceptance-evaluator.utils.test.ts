import { describe, expect, it } from "vitest";
import {
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT,
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
} from "@kernel/types/portable-runtime-acceptance.types.js";
import {
  evaluatePortableRuntimeAcceptance,
  type PortableRuntimeAcceptanceEvidence,
  type PortableRuntimeAcceptanceEvaluationContext,
} from "./portable-runtime-acceptance-evaluator.utils.js";
import type { VerificationRecord } from "@kernel/types/verification-record.types.js";

const context: PortableRuntimeAcceptanceEvaluationContext = {
  appId: "nextclaw.portable-runtime-reference",
  environment: "linux-x64",
  productVersion: "0.46.0",
  runtimeVersion: "0.2.0",
  implementationFingerprint: "sha256:implementation",
  contractFingerprint: PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
};

function record(overrides: Partial<VerificationRecord> = {}): VerificationRecord {
  return {
    evidenceSchemaVersion: 2,
    evidenceSource: "local",
    verificationRunId: "run-1",
    acceptanceId: "PRT-EXEC-001",
    scenarioVersion: "exec-v1",
    productVersion: context.productVersion,
    runtimeVersion: context.runtimeVersion,
    implementationFingerprint: context.implementationFingerprint,
    status: "passed",
    startedAt: "2026-08-30T00:00:00.000Z",
    finishedAt: "2026-08-30T00:00:01.000Z",
    environment: context.environment,
    appId: context.appId,
    componentId: "reference",
    role: "system",
    entrySurface: "system",
    actionOrEvent: "verify",
    callId: "call-1",
    traceId: "trace-1",
    capabilityDecisions: [],
    inputDigest: "input",
    dataVersion: "v1",
    evidenceRefs: ["ci://run/1"],
    ...overrides,
  };
}

function evaluate(records: VerificationRecord[], source: PortableRuntimeAcceptanceEvidence["source"] = "local") {
  return evaluatePortableRuntimeAcceptance({
    context,
    evidence: [{ source, records }],
    definitions: [PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT[0]],
  })[0]!;
}

describe("portable runtime acceptance evaluator", () => {
  it("keeps the complete stable PRT registry", () => {
    expect(PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT).toHaveLength(22);
    expect(new Set(PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT.map((entry) => entry.id)).size).toBe(22);
    expect(new Set(PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT.map((entry) => entry.checkerKey)).size).toBe(22);
    expect(PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "PRT-EXEC-001", titleKey: expect.any(String), descriptionKey: expect.any(String), category: "execution" }),
    ]));
  });

  it("distinguishes missing, stale, failed, and latest current passed evidence", () => {
    expect(evaluate([]).status).toBe("missing");
    expect(evaluate([record({ implementationFingerprint: "sha256:old" })]).status).toBe("stale");
    expect(evaluate([record({ appId: "other-app" })]).status).toBe("stale");
    expect(evaluate([record({ environment: "darwin-arm64" })]).status).toBe("stale");
    expect(evaluate([record({ status: "failed" })]).status).toBe("failed");
    expect(evaluate([
      record({ status: "failed", finishedAt: "2026-08-30T00:00:01.000Z" }),
      record({ verificationRunId: "run-2", finishedAt: "2026-08-30T00:00:02.000Z" }),
    ]).status).toBe("current-passed");
  });

  it("uses the newest duplicate record and rejects old schema records as stale", () => {
    expect(evaluate([
      record({ verificationRunId: "run-a", status: "passed", finishedAt: "2026-08-30T00:00:02.000Z" }),
      record({ verificationRunId: "run-z", status: "failed", finishedAt: "2026-08-30T00:00:02.000Z" }),
    ]).status).toBe("failed");
    const oldRecord = { ...record(), evidenceSchemaVersion: 1 };
    delete (oldRecord as Partial<VerificationRecord>).productVersion;
    delete (oldRecord as Partial<VerificationRecord>).runtimeVersion;
    delete (oldRecord as Partial<VerificationRecord>).implementationFingerprint;
    expect(evaluate([oldRecord as never]).status).toBe("stale");
  });
});
