import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { VerificationRecordService } from "./verification-record.service.js";

const directories: string[] = [];

async function createService(): Promise<VerificationRecordService> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nextclaw-verification-record-"));
  directories.push(directory);
  return new VerificationRecordService({ storePath: path.join(directory, "records.json") });
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) =>
    await rm(directory, { recursive: true, force: true })));
});

describe("VerificationRecordService", () => {
  it("persists redacted invocation facts and filters exported evidence", async () => {
    const service = await createService();
    const now = "2026-08-30T00:00:00.000Z";
    const stored = await service.record({
      verificationRunId: "run-1",
      evidenceSource: "local",
      acceptanceId: "PRT-ENTRY-001",
      scenarioVersion: "service-action-v1",
      productVersion: "0.46.0",
      runtimeVersion: "0.2.0",
      implementationFingerprint: "sha256:implementation",
      status: "passed",
      startedAt: now,
      finishedAt: now,
      environment: "linux-x64",
      appId: "example.notes",
      componentId: "notes",
      role: "cli",
      entrySurface: "installed-app-cli",
      instanceId: "default",
      actionOrEvent: "records_list",
      callId: "call-1",
      traceId: "trace-1",
      capabilityDecisions: ["storage:granted"],
      inputDigest: "input-digest",
      outputDigest: "output-digest",
      dataVersion: "instance-v1:1",
      evidenceRefs: ["notes.records_list"],
    });

    expect(stored).toMatchObject({ verificationRunId: "run-1", evidenceSchemaVersion: 2, status: "passed" });
    await expect(service.list({ acceptanceId: "PRT-ENTRY-001" })).resolves.toEqual({
      entries: [expect.objectContaining({ callId: "call-1", traceId: "trace-1" })],
    });
    await expect(service.export({ appId: "other" })).resolves.toBe('{\n  "entries": []\n}\n');
    const persisted = JSON.parse(await readFile(path.join(directories[0]!, "records.json"), "utf8")) as {
      entries: Array<Record<string, unknown>>;
    };
    expect(persisted.entries[0]).not.toHaveProperty("input");
    expect(persisted.entries[0]).not.toHaveProperty("output");
  });

  it("retains v1 records as stale-compatible evidence and rejects malformed current stores", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "nextclaw-verification-record-"));
    directories.push(directory);
    const storePath = path.join(directory, "records.json");
    const now = "2026-08-30T00:00:00.000Z";
    await writeFile(storePath, `${JSON.stringify({
      schemaVersion: 1,
      entries: [{
        verificationRunId: "old-run",
        acceptanceId: "PRT-ENTRY-001",
        scenarioVersion: "service-action-v1",
        status: "passed",
        startedAt: now,
        finishedAt: now,
        environment: "linux-x64",
        appId: "example.notes",
        componentId: "notes",
        role: "system",
        entrySurface: "system",
        actionOrEvent: "verify",
        callId: "call",
        traceId: "trace",
        capabilityDecisions: [],
        inputDigest: "input",
        dataVersion: "v1",
        evidenceRefs: [],
      }],
    })}\n`);
    const service = new VerificationRecordService({ storePath });
    await expect(service.list()).resolves.toEqual({
      entries: [expect.objectContaining({ verificationRunId: "old-run", evidenceSchemaVersion: 1 })],
    });

    const invalidPath = path.join(directory, "invalid.json");
    await writeFile(invalidPath, '{"schemaVersion":2,"entries":[{"evidenceSchemaVersion":2}]}\n');
    const invalid = new VerificationRecordService({ storePath: invalidPath });
    await expect(invalid.list()).rejects.toThrow("Verification record has invalid required evidence fields");
  });

  it("requires an explicit, valid source for current evidence", async () => {
    const service = await createService();
    const base = {
      verificationRunId: "run-source", acceptanceId: "PRT-EXEC-001", scenarioVersion: "exec-v1",
      productVersion: "0.46.0", runtimeVersion: "0.46.0", implementationFingerprint: "sha256:implementation",
      status: "passed" as const, startedAt: "2026-08-30T00:00:00.000Z", finishedAt: "2026-08-30T00:00:01.000Z",
      environment: "linux-x64", appId: "example.runtime", componentId: "runtime", role: "system" as const,
      entrySurface: "system" as const, actionOrEvent: "verify", callId: "call", traceId: "trace",
      capabilityDecisions: [], inputDigest: "input", dataVersion: "v1", evidenceRefs: [],
    };
    await expect(service.record(base)).rejects.toThrow("evidence source");
    await expect(service.record({ ...base, evidenceSource: "other" as never })).rejects.toThrow("evidence source");
  });

  it("adds local provenance from the Kernel identity for ordinary runtime records", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "nextclaw-verification-record-"));
    directories.push(directory);
    const service = new VerificationRecordService({
      storePath: path.join(directory, "records.json"),
      resolveCurrentIdentity: async (appId) => ({
        appId,
        environment: "linux-x64",
        productVersion: "0.46.0",
        runtimeVersion: "0.46.0",
        implementationFingerprint: "sha256:current",
        contractFingerprint: "sha256:contract",
      }),
    });
    const now = "2026-08-30T00:00:00.000Z";
    const stored = await service.record({
      verificationRunId: "runtime-run", acceptanceId: "PRT-ENTRY-001", scenarioVersion: "service-action-v1",
      status: "passed", startedAt: now, finishedAt: now, environment: "linux-x64", appId: "example.runtime",
      componentId: "runtime", role: "system", entrySurface: "system", actionOrEvent: "verify", callId: "call",
      traceId: "trace", capabilityDecisions: [], inputDigest: "input", dataVersion: "v1", evidenceRefs: [],
    });
    expect(stored).toMatchObject({
      evidenceSchemaVersion: 2,
      evidenceSource: "local",
      implementationFingerprint: "sha256:current",
    });
  });
});
