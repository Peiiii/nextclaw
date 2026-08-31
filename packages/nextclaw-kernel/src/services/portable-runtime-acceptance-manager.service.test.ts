import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT,
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
} from "@kernel/types/portable-runtime-acceptance.types.js";
import { PortableRuntimeAcceptanceIdentityService } from "./portable-runtime-acceptance-identity.service.js";
import {
  PORTABLE_RUNTIME_ACCEPTANCE_REFERENCE_APP_ID,
  PortableRuntimeAcceptanceManager,
} from "./portable-runtime-acceptance-manager.service.js";
import { VerificationRecordService } from "./verification-record.service.js";

const directories: string[] = [];

function createManager(params: { platform?: NodeJS.Platform; arch?: string } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-portable-acceptance-"));
  directories.push(directory);
  const runnerPath = join(directory, "nextclaw-wasmtime-runner");
  writeFileSync(runnerPath, "portable runner test fixture\n");
  chmodSync(runnerPath, 0o755);
  const verificationRecords = new VerificationRecordService({ storePath: join(directory, "records.json") });
  const identity = new PortableRuntimeAcceptanceIdentityService({
      productVersion: "0.46.0",
      runtimeVersion: "0.46.0",
      portableServiceRunnerPath: runnerPath,
      platform: params.platform ?? "linux",
      arch: params.arch ?? "x64",
  });
  return {
    verificationRecords,
    identity,
    manager: new PortableRuntimeAcceptanceManager({ verificationRecords, identity }),
  };
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    // Test directories only; no product data is touched.
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("PortableRuntimeAcceptanceManager", () => {
  it("projects every registered contract item with one localized mapping", async () => {
    const { manager } = createManager();
    const contract = manager.contract("zh-CN");
    const status = await manager.status();

    expect(contract.contractFingerprint).toBe(PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT);
    expect(contract.definitions.map((entry) => entry.id)).toEqual(
      PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT.map((entry) => entry.id),
    );
    expect(contract.definitions.every((entry) => entry.presentation.title && entry.presentation.description)).toBe(true);
    expect(status.appId).toBe(PORTABLE_RUNTIME_ACCEPTANCE_REFERENCE_APP_ID);
    expect(status.entries.map((entry) => entry.id)).toEqual(contract.definitions.map((entry) => entry.id));
    expect(status.summary.missing).toBe(PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT.length);
  });

  it("projects an added registry definition without a surface-specific id list", async () => {
    const { verificationRecords, identity } = createManager();
    const original = PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT[0]!;
    const definitions = [...PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT, {
      ...original,
      id: "PRT-PROJECTION-TEST-001",
      checkerKey: "portable-runtime.projection-test",
      // The presentation owner consumes keys; a real registry addition must
      // add its own pair there or fail visibly rather than show a fake title.
      titleKey: original.titleKey,
      descriptionKey: original.descriptionKey,
    }];
    const projected = new PortableRuntimeAcceptanceManager({
      verificationRecords,
      identity,
      definitions,
    });
    // Keep the assertion structural: it proves the manager iterates the
    // registry it receives, rather than comparing a hard-coded string list.
    expect((await projected.status()).entries).toHaveLength(definitions.length);
    expect(projected.contract().definitions.at(-1)?.checkerKey).toBe("portable-runtime.projection-test");
  });

  it("uses the persisted evidence source instead of relabelling CI evidence as local", async () => {
    const { manager, identity, verificationRecords } = createManager();
    const resolved = await identity.resolve(PORTABLE_RUNTIME_ACCEPTANCE_REFERENCE_APP_ID);
    if (!resolved.available) throw new Error("test runner identity must be available");
    await verificationRecords.record({
      evidenceSource: "ci",
      verificationRunId: "ci-performance",
      acceptanceId: "PRT-PERF-001",
      scenarioVersion: "performance-v1",
      productVersion: resolved.context.productVersion,
      runtimeVersion: resolved.context.runtimeVersion,
      implementationFingerprint: resolved.context.implementationFingerprint,
      status: "passed",
      startedAt: "2026-08-30T00:00:00.000Z",
      finishedAt: "2026-08-30T00:00:01.000Z",
      environment: resolved.context.environment,
      appId: resolved.context.appId,
      componentId: "runtime",
      role: "system",
      entrySurface: "system",
      actionOrEvent: "performance-check",
      callId: "ci-call",
      traceId: "ci-trace",
      capabilityDecisions: [],
      inputDigest: "input",
      dataVersion: "v1",
      evidenceRefs: ["ci://run/1"],
    });
    const entry = (await manager.status()).entries.find((item) => item.id === "PRT-PERF-001");
    expect(entry?.result.status).toBe("current-passed");
    expect(entry?.result.latestRecord).toMatchObject({ evidenceSource: "ci" });
  });

  it("never lets prior records certify an unavailable current runner identity", async () => {
    const directory = mkdtempSync(join(tmpdir(), "nextclaw-portable-acceptance-unavailable-"));
    directories.push(directory);
    const records = new VerificationRecordService({ storePath: join(directory, "records.json") });
    await records.record({
      evidenceSource: "local",
      acceptanceId: "PRT-EXEC-001", scenarioVersion: "exec-v1", status: "passed",
      productVersion: "0.46.0", runtimeVersion: "0.46.0", implementationFingerprint: "sha256:old",
      startedAt: "2026-08-30T00:00:00.000Z", finishedAt: "2026-08-30T00:00:01.000Z", environment: "linux-x64",
      appId: PORTABLE_RUNTIME_ACCEPTANCE_REFERENCE_APP_ID, componentId: "watcher", role: "system", entrySurface: "system",
      actionOrEvent: "verify", callId: "call-1", traceId: "trace-1", capabilityDecisions: [], inputDigest: "input", dataVersion: "v1", evidenceRefs: [],
    });
    const manager = new PortableRuntimeAcceptanceManager({
      verificationRecords: records,
      identity: new PortableRuntimeAcceptanceIdentityService({ productVersion: "0.46.0", portableServiceRunnerPath: join(directory, "missing-runner"), platform: "linux", arch: "x64" }),
    });
    const status = await manager.status();
    expect(status.identity.available).toBe(false);
    expect(status.entries.find((entry) => entry.id === "PRT-EXEC-001")?.result.status).toBe("stale");
    expect(status.entries.filter((entry) => entry.id !== "PRT-EXEC-001").every((entry) => entry.result.status === "missing")).toBe(true);
  });

  it.each([
    ["darwin", "arm64", "darwin-arm64"],
    ["win32", "x64", "windows-x64"],
  ] as const)("keeps a missing runner non-green on %s/%s", async (platform, arch, environment) => {
    const directory = mkdtempSync(join(tmpdir(), "nextclaw-portable-acceptance-unavailable-"));
    directories.push(directory);
    const verificationRecords = new VerificationRecordService({ storePath: join(directory, "records.json") });
    const identity = new PortableRuntimeAcceptanceIdentityService({
      productVersion: "0.46.0",
      portableServiceRunnerPath: join(directory, "missing-runner"),
      platform,
      arch,
    });
    const status = await new PortableRuntimeAcceptanceManager({ verificationRecords, identity }).status();
    expect(status.identity).toMatchObject({ available: false, environment });
    expect(status.entries.every((entry) => entry.result.environment === environment)).toBe(true);
    expect(status.entries.every((entry) => entry.result.status !== "current-passed")).toBe(true);
  });
});
