import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const rootDir = path.resolve(import.meta.dirname, "../..");
function run(args) {
  return spawnSync("pnpm", ["-C", "packages/nextclaw", "exec", "tsx", "--tsconfig", "../nextclaw-kernel/tsconfig.json", "../../scripts/release/portable-runtime-acceptance-gate.ts", ...args], {
    cwd: rootDir,
    encoding: "utf8",
  });
}

test("release gate fail-closes only on a structured candidate artifact", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nextclaw-prt-gate-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const printedContract = run(["--print-contract"]);
  assert.equal(printedContract.status, 0, printedContract.stderr);
  const { definitions: contract, fingerprint: contractFingerprint } = JSON.parse(printedContract.stdout);
  const target = (environment) => ({
    appId: "nextclaw.portable-runtime-reference",
    environment,
    productVersion: "0.46.0",
    runtimeVersion: "0.2.0",
    implementationFingerprint: "sha256:implementation",
    contractFingerprint,
    evidence: ["local", "ci", "release"].map((source) => ({ source, records: contract
      .filter((definition) => definition.evidenceSource === source)
      .map((definition) => ({
        evidenceSchemaVersion: 2,
        evidenceSource: source,
        verificationRunId: `run-${definition.id}`,
        acceptanceId: definition.id,
        scenarioVersion: definition.scenarioVersion,
        productVersion: "0.46.0",
        runtimeVersion: "0.2.0",
        implementationFingerprint: "sha256:implementation",
        status: "passed",
        startedAt: "2026-08-30T00:00:00.000Z",
        finishedAt: "2026-08-30T00:00:01.000Z",
        environment,
        appId: "nextclaw.portable-runtime-reference",
        componentId: "reference",
        role: "system",
        entrySurface: "system",
        actionOrEvent: "verify",
        callId: `call-${definition.id}`,
        traceId: `trace-${definition.id}`,
        capabilityDecisions: [],
        inputDigest: "input",
        dataVersion: "v1",
        evidenceRefs: [`ci://run/${definition.id}`],
      })),
    })),
  });
  const artifact = {
    schemaVersion: 1,
    contractFingerprint,
    targets: ["darwin-arm64", "windows-x64", "linux-x64"].map(target),
  };
  const sourcePath = path.join(directory, "source.json");
  const candidatePath = path.join(directory, "candidate.json");
  await writeFile(sourcePath, `${JSON.stringify(artifact)}\n`);
  const prepare = run(["--prepare", "--input", sourcePath, "--output", candidatePath]);
  assert.equal(prepare.status, 0, prepare.stderr);
  const releaseEvidence = artifact.targets[0].evidence.find((entry) => entry.source === "release");
  releaseEvidence.records = [];
  await writeFile(sourcePath, `${JSON.stringify(artifact)}\n`);
  const prepareWithoutRelease = run(["--prepare", "--input", sourcePath, "--output", candidatePath]);
  assert.equal(prepareWithoutRelease.status, 0, prepareWithoutRelease.stderr);
  const passed = run(["--stage", "prepublish", "--artifact", candidatePath]);
  assert.equal(passed.status, 0, passed.stderr);

  const postpublish = run(["--stage", "postpublish", "--artifact", candidatePath]);
  assert.notEqual(postpublish.status, 0);
  assert.match(postpublish.stderr, /PRT-REL-001@darwin-arm64/);

  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  candidate.targets.find((entry) => entry.environment === "linux-x64").evidence
    .find((entry) => entry.source === "local").records = [];
  await writeFile(candidatePath, `${JSON.stringify(candidate)}\n`);
  const failed = run(["--stage", "prepublish", "--artifact", candidatePath]);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /PRT-EXEC-001@linux-x64/);
});

test("portable runtime acceptance remains independent from the stable release path", async () => {
  const stableRelease = await readFile(path.join(rootDir, "scripts/release/release-stable.mjs"), "utf8");
  const releaseWorkflow = await readFile(path.join(rootDir, ".github/workflows/release.yml"), "utf8");
  assert.doesNotMatch(stableRelease, /NEXTCLAW_PORTABLE_RUNTIME_ACCEPTANCE_EVIDENCE/);
  assert.doesNotMatch(stableRelease, /release:portable-runtime:acceptance:validate:prepublish/);
  assert.doesNotMatch(releaseWorkflow, /portable-runtime-ci-evidence-summary/);
});
