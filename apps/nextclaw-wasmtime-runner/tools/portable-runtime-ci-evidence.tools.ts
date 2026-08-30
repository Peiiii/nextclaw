/**
 * Emits the portable-runtime acceptance artifact from the *results* of the
 * concrete runners. It is deliberately a verifier, not a test runner: a CI
 * exit code is never turned into a blanket set of green records.
 *
 * Each runner owns its named checks. Adding a PRT ID requires adding a real
 * check to that runner first; this file only signs the exact names below.
 * Missing or renamed checks therefore fail the candidate rather than silently
 * becoming green.
 */
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT,
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
  type PortableRuntimeAcceptanceId,
  type PortableRuntimeAcceptancePlatform,
} from "../../../packages/nextclaw-kernel/src/types/portable-runtime-acceptance.types.js";
import {
  evaluatePortableRuntimeAcceptanceArtifact,
  parsePortableRuntimeAcceptanceEvidenceArtifact,
  type PortableRuntimeAcceptanceEvidenceArtifact,
} from "../../../packages/nextclaw-kernel/src/utils/portable-runtime-acceptance-evaluator.utils.js";
import {
  PortableRuntimeAcceptanceIdentityService,
} from "../../../packages/nextclaw-kernel/src/services/portable-runtime-acceptance-identity.service.js";
import type { VerificationRecord } from "../../../packages/nextclaw-kernel/src/types/verification-record.types.js";

const EXPECTED_TARGETS: readonly PortableRuntimeAcceptancePlatform[] = ["darwin-arm64", "windows-x64", "linux-x64"];
const REFERENCE_APP_ID = "nextclaw.github-issue-watcher";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

type CheckSource = "runner" | "developer" | "kernel" | "performance" | "reference" | "docs";
type CheckRequirement = readonly [CheckSource, string];

/**
 * One ID -> its observable assertions. Do not replace this with broad `ok`
 * checks: this is the executable explanation for every signed record.
 */
const CHECK_REQUIREMENTS: Record<Exclude<PortableRuntimeAcceptanceId, "PRT-REL-001">, readonly CheckRequirement[]> = {
  "PRT-EXEC-001": [["runner", "list-actions"], ["developer", "installed-cli-action"]],
  "PRT-DATA-001": [["runner", "host.kv"], ["reference", "standard-wasi-kv"], ["runner", "standard-spin-sqlite"], ["runner", "sqlite-instance-isolation"], ["runner", "sqlite-restart-persistence"], ["runner", "sqlite-concurrency"], ["runner", "sqlite-denied"], ["developer", "persistence-across-reenable"]],
  "PRT-FILE-001": [["runner", "filesystem-preopen"], ["runner", "filesystem-isolation"], ["runner", "filesystem-revocation"]],
  "PRT-NET-001": [["runner", "standard-wasi-http-allowed-host"], ["runner", "standard-wasi-http-loopback"], ["runner", "standard-wasi-http-redirect-target"], ["runner", "standard-wasi-http-timeout"], ["runner", "standard-wasi-http-response-size"]],
  "PRT-SECRET-001": [["runner", "standard-wasi-secret"], ["runner", "standard-wasi-secret-unresolved"], ["runner", "secret-rotation"], ["runner", "secret-revocation"], ["runner", "secret-no-leakage"]],
  "PRT-RES-001": [["runner", "resident-cold-list-actions"], ["runner", "resident"], ["developer", "resident-disable-reenable"]],
  "PRT-EVENT-001": [["runner", "resident-typed-disposition"], ["runner", "resident-typed-retry"], ["kernel", "event-dedupe"], ["kernel", "event-cursor-order"]],
  "PRT-TASK-001": [["runner", "job-progress"], ["runner", "job-cancel-isolated"], ["runner", "job-timeout"], ["kernel", "job-recovery"]],
  "PRT-STREAM-001": [["runner", "stream-backpressure"], ["runner", "stream-cancel"], ["kernel", "stream-disconnect-limit"]],
  "PRT-AGENT-001": [["developer", "agent-installed-action"]],
  "PRT-AI-001": [["runner", "ai-model-complete"], ["runner", "ai-agent-start"], ["runner", "ai-denied"], ["runner", "ai-cancel"], ["runner", "ai-no-secret-leak"]],
  "PRT-COMP-001": [["runner", "provider"], ["runner", "composition"], ["runner", "provider-denied"], ["kernel", "provider-version-incompatible"]],
  "PRT-ENTRY-001": [["developer", "panel-installed-action"], ["developer", "agent-installed-action"], ["developer", "installed-cli-action"], ["developer", "entry-fact-equivalence"]],
  "PRT-LIFE-001": [["developer", "install-relative"], ["developer", "enable"], ["developer", "disable-reenable"], ["developer", "update"], ["developer", "rollback"], ["developer", "uninstall-retain"], ["developer", "reinstall-retain"], ["developer", "uninstall-purge"]],
  "PRT-BOUND-001": [["runner", "multi-app-isolation"], ["runner", "timeout-isolated"], ["runner", "memory-bound-isolated"]],
  "PRT-PERF-001": [["performance", "equivalent-counter-workload"], ["performance", "budget-within-range"], ["performance", "resident-density"], ["performance", "unload-recovery"]],
  "PRT-DX-001": [["developer", "doctor"], ["developer", "create"], ["developer", "build"], ["developer", "check"], ["developer", "test"], ["developer", "pack"], ["developer", "install-relative"], ["developer", "installed-cli-action"]],
  "PRT-DIST-001": [["runner", "list-actions"], ["developer", "enable"], ["developer", "installed-cli-action"], ["developer", "disable-reenable"]],
  "PRT-EVID-001": [["developer", "acceptance-contract"], ["developer", "verification-record"], ["developer", "acceptance-export"]],
  "PRT-REF-001": [["reference", "github-sync"], ["reference", "persisted-list"], ["reference", "public-issue-shape"]],
  "PRT-DOCS-001": [["docs", "user-guide"], ["docs", "developer-contract"], ["docs", "commands"], ["docs", "distribution"], ["docs", "observability"]],
};

async function main(): Promise<void> {
  if (process.argv.includes("--print-check-requirements")) {
    process.stdout.write(`${JSON.stringify(CHECK_REQUIREMENTS, null, 2)}\n`);
    return;
  }
  if (process.argv.includes("--aggregate")) return await aggregate();
  if (process.argv.includes("--verify-docs")) return await verifyDocs();
  await createFragment();
}

async function createFragment(): Promise<void> {
  const output = required("--output");
  const target = parseTarget(required("--target"));
  const results = {
    runner: await readCheckResult(required("--runner-smoke"), "nextclaw.portable-runtime.runner-smoke"),
    kernel: await readCheckResult(required("--kernel"), "nextclaw.portable-runtime.kernel-scenarios"),
    performance: await readCheckResult(required("--performance"), "nextclaw.portable-runtime.performance"),
    developer: await readCheckResult(required("--developer"), "nextclaw.portable-runtime.developer-smoke"),
    reference: await readCheckResult(required("--reference"), "nextclaw.portable-runtime.reference-app"),
    docs: await readCheckResult(required("--docs"), "nextclaw.portable-runtime.documentation"),
  } as const;
  // The source checkout still has its pre-version package.json during a
  // stable release.  Evidence must describe the immutable Changesets plan,
  // never the stale source version and never a postpublish rewrite.
  const productVersion = requiredStableVersion("--product-version");
  const runtimeVersion = requiredStableVersion("--runtime-version");
  const identity = await new PortableRuntimeAcceptanceIdentityService({
    productVersion,
    runtimeVersion,
    portableServiceRunnerPath: resolve(root, required("--runner")),
    ...platformFor(target),
  }).resolve(REFERENCE_APP_ID);
  if (!identity.available) throw new Error(`Unable to resolve Kernel acceptance identity: ${identity.reason}`);
  const targetContext = {
    appId: REFERENCE_APP_ID,
    environment: target,
    productVersion,
    runtimeVersion,
    implementationFingerprint: identity.context.implementationFingerprint,
    contractFingerprint: identity.context.contractFingerprint,
  };
  const records = PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT
    .filter((definition) => definition.required && definition.evidenceSource !== "release")
    .map((definition) => createRecord({ definition, target, targetContext, results }));
  const artifact: PortableRuntimeAcceptanceEvidenceArtifact = {
    schemaVersion: 1,
    contractFingerprint: PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
    targets: [{ ...targetContext, evidence: groupByEvidenceSource(records) }],
  };
  await assertFragment(artifact, target);
  await writeJson(output, artifact);
}

function createRecord(params: {
  definition: (typeof PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT)[number];
  target: PortableRuntimeAcceptancePlatform;
  targetContext: { appId: string; productVersion: string; runtimeVersion: string; implementationFingerprint: string };
  results: Record<CheckSource, CheckResult>;
}): VerificationRecord {
  const { definition, target, targetContext, results } = params;
  const requirements = CHECK_REQUIREMENTS[definition.id as Exclude<PortableRuntimeAcceptanceId, "PRT-REL-001">];
  if (!requirements) throw new Error(`No concrete checker mapping is registered for ${definition.id}.`);
  for (const [source, check] of requirements) {
    if (!results[source].checks.has(check)) {
      throw new Error(`${definition.id} requires ${source}:${check}, but that runner did not report a successful structured check.`);
    }
  }
  const now = new Date().toISOString();
  const evidenceSource = definition.evidenceSource;
  const inputDigest = digest(JSON.stringify(requirements.map(([source, check]) => ({ source, check, digest: results[source].digest }))));
  return {
    evidenceSchemaVersion: 2,
    evidenceSource,
    verificationRunId: `ci-${target}-${definition.id.toLowerCase()}-${randomUUID()}`,
    acceptanceId: definition.id,
    scenarioVersion: definition.scenarioVersion,
    productVersion: targetContext.productVersion,
    runtimeVersion: targetContext.runtimeVersion,
    implementationFingerprint: targetContext.implementationFingerprint,
    status: "passed",
    startedAt: now,
    finishedAt: new Date().toISOString(),
    environment: target,
    appId: targetContext.appId,
    componentId: "portable-runtime-ci",
    role: "system",
    entrySurface: "system",
    actionOrEvent: requirements.map(([source, check]) => `${source}:${check}`).join(","),
    callId: `ci-${target}-${definition.id}`,
    traceId: `ci-${target}-${definition.id.toLowerCase()}`,
    capabilityDecisions: requirements.map(([source, check]) => `${source}:${check}:passed`),
    inputDigest,
    outputDigest: inputDigest,
    dataVersion: `ci-${target}-${definition.scenarioVersion}`,
    observation: { durationMs: 0, runnerPid: null, memory: null },
    evidenceRefs: requirements.map(([source, check]) => `ci://github/${process.env.GITHUB_RUN_ID ?? "local-ci"}/${target}/${source}/${check}`),
  };
}

function groupByEvidenceSource(records: VerificationRecord[]): PortableRuntimeAcceptanceEvidenceArtifact["targets"][number]["evidence"] {
  return (["local", "ci"] as const).map((source) => ({ source, records: records.filter((record) => record.evidenceSource === source) }));
}

async function aggregate(): Promise<void> {
  const inputDirectory = required("--input-dir");
  const output = required("--output");
  const productVersion = requiredStableVersion("--product-version");
  const runtimeVersion = requiredStableVersion("--runtime-version");
  const files = (await readdir(inputDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && EXPECTED_TARGETS.includes(entry.name.replace(/\.json$/, "") as PortableRuntimeAcceptancePlatform))
    .map((entry) => resolve(inputDirectory, entry.name));
  if (files.length !== EXPECTED_TARGETS.length) throw new Error(`Expected exactly ${EXPECTED_TARGETS.length} complete target fragments, found ${files.length}.`);
  const targets = [] as PortableRuntimeAcceptanceEvidenceArtifact["targets"];
  for (const file of files) {
    const artifact = parsePortableRuntimeAcceptanceEvidenceArtifact(JSON.parse(await readFile(file, "utf8")));
    if (artifact.contractFingerprint !== PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT || artifact.targets.length !== 1) {
      throw new Error(`Invalid acceptance fragment: ${basename(file)}`);
    }
    await assertFragment(artifact, artifact.targets[0]!.environment, { productVersion, runtimeVersion });
    targets.push(artifact.targets[0]!);
  }
  const environments = targets.map((target) => target.environment);
  if (new Set(environments).size !== EXPECTED_TARGETS.length || EXPECTED_TARGETS.some((target) => !environments.includes(target))) {
    throw new Error(`Acceptance fragments must cover exactly ${EXPECTED_TARGETS.join(", ")}.`);
  }
  const artifact: PortableRuntimeAcceptanceEvidenceArtifact = {
    schemaVersion: 1,
    contractFingerprint: PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
    targets: targets.sort((left, right) => EXPECTED_TARGETS.indexOf(left.environment) - EXPECTED_TARGETS.indexOf(right.environment)),
  };
  assertPrepublishCandidate(artifact, { productVersion, runtimeVersion });
  await writeJson(output, artifact);
}

function assertPrepublishCandidate(
  artifact: PortableRuntimeAcceptanceEvidenceArtifact,
  expectedVersion?: { productVersion: string; runtimeVersion: string },
): void {
  if (expectedVersion && artifact.targets.some((target) =>
    target.productVersion !== expectedVersion.productVersion || target.runtimeVersion !== expectedVersion.runtimeVersion,
  )) {
    throw new Error("Complete prepublish candidate versions do not match the exact planned release version.");
  }
  const evaluated = evaluatePortableRuntimeAcceptanceArtifact(artifact);
  const open = PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT
    .filter((definition) => definition.required && definition.evidenceSource !== "release")
    .flatMap((definition) => definition.platforms.map((environment) => {
      const result = evaluated.find((entry) => entry.environment === environment && entry.acceptanceId === definition.id);
      return result?.status === "current-passed" ? undefined : `${definition.id}@${environment}`;
    })).filter((entry): entry is string => Boolean(entry));
  if (open.length > 0) throw new Error(`Complete prepublish candidate is missing current evidence: ${open.join(", ")}`);
}

async function assertFragment(
  artifact: PortableRuntimeAcceptanceEvidenceArtifact,
  target: PortableRuntimeAcceptancePlatform,
  expectedVersion?: { productVersion: string; runtimeVersion: string },
): Promise<void> {
  const parsed = parsePortableRuntimeAcceptanceEvidenceArtifact(artifact);
  if (parsed.contractFingerprint !== PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT || parsed.targets.length !== 1 || parsed.targets[0]!.environment !== target) {
    throw new Error("Acceptance evidence fragment has an invalid envelope.");
  }
  if (expectedVersion && (parsed.targets[0]!.productVersion !== expectedVersion.productVersion ||
    parsed.targets[0]!.runtimeVersion !== expectedVersion.runtimeVersion)) {
    throw new Error(`Acceptance fragment version does not match planned release for ${target}.`);
  }
  const expected = PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT.filter((definition) => definition.required && definition.evidenceSource !== "release");
  for (const source of ["local", "ci"] as const) {
    const evidence = parsed.targets[0]!.evidence.find((candidate) => candidate.source === source);
    const expectedIds = expected.filter((definition) => definition.evidenceSource === source).map((definition) => definition.id);
    if (!evidence || evidence.records.length !== expectedIds.length || evidence.records.some((record) =>
      record.evidenceSchemaVersion !== 2 || record.status !== "passed" || record.evidenceSource !== source || !expectedIds.includes(record.acceptanceId),
    )) throw new Error(`Acceptance fragment has invalid ${source} evidence for ${target}.`);
  }
  const evaluated = evaluatePortableRuntimeAcceptanceArtifact(parsed);
  const open = expected.map((definition) => {
    const result = evaluated.find((entry) => entry.environment === target && entry.acceptanceId === definition.id);
    return result?.status === "current-passed" ? undefined : `${definition.id}@${target}`;
  }).filter((entry): entry is string => Boolean(entry));
  if (open.length > 0) throw new Error(`Acceptance fragment does not have current evidence: ${open.join(", ")}`);
}

type CheckResult = { checks: Set<string>; digest: string };

async function readCheckResult(filePath: string, expectedKind: string): Promise<CheckResult> {
  const parsed = JSON.parse(await readFile(resolve(root, filePath), "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error(`${filePath} must contain an object.`);
  const value = parsed as { schemaVersion?: unknown; kind?: unknown; ok?: unknown; checks?: unknown };
  if (value.schemaVersion !== 1 || value.kind !== expectedKind || value.ok !== true || !Array.isArray(value.checks) ||
    value.checks.some((check) => typeof check !== "string" || check.length === 0)) {
    throw new Error(`${filePath} is not a successful structured ${expectedKind} result.`);
  }
  return { checks: new Set(value.checks), digest: digest(JSON.stringify(value)) };
}

async function verifyDocs(): Promise<void> {
  const output = required("--output");
  const docs = [
    ["user-guide", "apps/docs/zh/guide/service-apps.md", "apps/docs/en/guide/service-apps.md"],
    ["developer-contract", "apps/docs/zh/developers/portable-runtime-contracts.md", "apps/docs/en/developers/portable-runtime-contracts.md"],
    ["commands", "apps/docs/zh/guide/commands.md", "apps/docs/en/guide/commands.md"],
    ["distribution", "apps/docs/zh/developers/portable-runtime-distribution.md", "apps/docs/en/developers/portable-runtime-distribution.md"],
    ["observability", "apps/docs/zh/developers/portable-runtime-observability.md", "apps/docs/en/developers/portable-runtime-observability.md"],
  ] as const;
  for (const [, ...paths] of docs) await Promise.all(paths.map(async (entry) => await access(resolve(root, entry), constants.R_OK)));
  const commandDocs = await Promise.all(["apps/docs/zh/guide/commands.md", "apps/docs/en/guide/commands.md"].map(async (entry) => await readFile(resolve(root, entry), "utf8")));
  if (commandDocs.some((contents) => !contents.includes("app acceptance status") || !contents.includes("app acceptance export"))) {
    throw new Error("Portable runtime command documentation does not expose acceptance status/export.");
  }
  await writeJson(output, {
    schemaVersion: 1,
    kind: "nextclaw.portable-runtime.documentation",
    ok: true,
    checks: docs.map(([check]) => check),
    checkedAt: new Date().toISOString(),
  });
}

function digest(value: string): string { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
async function writeJson(filePath: string, value: unknown): Promise<void> {
  const target = resolve(filePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function required(name: string): string { const value = optional(name); if (!value) throw new Error(`Missing ${name}.`); return value; }
function optional(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function requiredStableVersion(name: string): string {
  const value = required(name);
  if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error(`${name} must be a stable semver.`);
  return value;
}
function parseTarget(value: string): PortableRuntimeAcceptancePlatform {
  if ((EXPECTED_TARGETS as readonly string[]).includes(value)) return value as PortableRuntimeAcceptancePlatform;
  throw new Error(`Unsupported portable runtime target: ${value}`);
}
function platformFor(target: PortableRuntimeAcceptancePlatform): { platform: NodeJS.Platform; arch: string } {
  if (target === "darwin-arm64") return { platform: "darwin", arch: "arm64" };
  if (target === "windows-x64") return { platform: "win32", arch: "x64" };
  return { platform: "linux", arch: "x64" };
}

void main().catch((error: unknown) => {
  console.error(`[portable-runtime-ci-evidence] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
