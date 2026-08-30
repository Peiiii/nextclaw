import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const tool = "../../apps/nextclaw-wasmtime-runner/tools/portable-runtime-ci-evidence.tools.ts";
const kernelScenarioTool = "../nextclaw-kernel/tools/portable-runtime-kernel-scenarios.tools.ts";
const runner = "apps/nextclaw-wasmtime-runner/target/release/nextclaw-wasmtime-runner";

function run(args) {
  return spawnSync("pnpm", ["-C", "packages/nextclaw", "exec", "tsx", "--tsconfig", "../nextclaw-kernel/tsconfig.json", tool, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function requirements() {
  const result = run(["--print-check-requirements"]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function structured(kind, checks) {
  return { schemaVersion: 1, kind, ok: true, checks };
}

test("CI evidence refuses broad ok fixtures and only emits a full candidate from named successful checks", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nextclaw-portable-ci-evidence-"));
  const files = {
    runner: path.join(directory, "runner.json"),
    kernel: path.join(directory, "kernel.json"),
    performance: path.join(directory, "performance.json"),
    developer: path.join(directory, "developer.json"),
    reference: path.join(directory, "reference.json"),
    docs: path.join(directory, "docs.json"),
  };
  for (const file of Object.values(files)) await writeFile(file, '{"ok":true}\n');
  const bad = run([
    "--target", "darwin-arm64", "--runner", runner,
    "--product-version", "0.99.0", "--runtime-version", "0.99.0",
    "--runner-smoke", files.runner, "--kernel", files.kernel, "--performance", files.performance,
    "--developer", files.developer, "--reference", files.reference, "--docs", files.docs,
    "--output", path.join(directory, "bad.json"),
  ]);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /successful structured/);

  const bySource = { runner: new Set(), kernel: new Set(), performance: new Set(), developer: new Set(), reference: new Set(), docs: new Set() };
  for (const entries of Object.values(requirements())) {
    for (const [source, check] of entries) bySource[source].add(check);
  }
  await writeFile(files.runner, `${JSON.stringify(structured("nextclaw.portable-runtime.runner-smoke", [...bySource.runner]))}\n`);
  await writeFile(files.kernel, `${JSON.stringify(structured("nextclaw.portable-runtime.kernel-scenarios", [...bySource.kernel]))}\n`);
  await writeFile(files.performance, `${JSON.stringify(structured("nextclaw.portable-runtime.performance", [...bySource.performance]))}\n`);
  await writeFile(files.developer, `${JSON.stringify(structured("nextclaw.portable-runtime.developer-smoke", [...bySource.developer]))}\n`);
  await writeFile(files.reference, `${JSON.stringify(structured("nextclaw.portable-runtime.reference-app", [...bySource.reference]))}\n`);
  await writeFile(files.docs, `${JSON.stringify(structured("nextclaw.portable-runtime.documentation", [...bySource.docs]))}\n`);

  // A valid envelope without the Kernel assertions must not be enough to sign
  // the four host-mediated contracts that only Kernel owns.
  await writeFile(files.kernel, `${JSON.stringify(structured("nextclaw.portable-runtime.kernel-scenarios", []))}\n`);
  const missingKernel = run([
    "--target", "darwin-arm64", "--runner", runner,
    "--product-version", "0.99.0", "--runtime-version", "0.99.0",
    "--runner-smoke", files.runner, "--kernel", files.kernel, "--performance", files.performance,
    "--developer", files.developer, "--reference", files.reference, "--docs", files.docs,
    "--output", path.join(directory, "missing-kernel.json"),
  ]);
  assert.notEqual(missingKernel.status, 0);
  assert.match(missingKernel.stderr, /PRT-EVENT-001 requires kernel:event-dedupe/);
  await writeFile(files.kernel, `${JSON.stringify(structured("nextclaw.portable-runtime.kernel-scenarios", [...bySource.kernel]))}\n`);

  for (const target of ["darwin-arm64", "windows-x64", "linux-x64"]) {
    const result = run([
      "--target", target, "--runner", runner,
      "--product-version", "0.99.0", "--runtime-version", "0.99.0",
      "--runner-smoke", files.runner, "--kernel", files.kernel, "--performance", files.performance,
      "--developer", files.developer, "--reference", files.reference, "--docs", files.docs,
      "--output", path.join(directory, `${target}.json`),
    ]);
    assert.equal(result.status, 0, result.stderr);
    const fragment = JSON.parse(await readFile(path.join(directory, `${target}.json`), "utf8"));
    assert.deepEqual(fragment.targets[0].evidence.map((entry) => entry.source), ["local", "ci"]);
    assert.equal(fragment.targets[0].evidence.flatMap((entry) => entry.records).length, 21);
  }
  const aggregate = run([
    "--aggregate", "--product-version", "0.99.0", "--runtime-version", "0.99.0",
    "--input-dir", directory, "--output", path.join(directory, "candidate.json"),
  ]);
  assert.equal(aggregate.status, 0, aggregate.stderr);
  const candidate = JSON.parse(await readFile(path.join(directory, "candidate.json"), "utf8"));
  assert.deepEqual(candidate.targets.map((target) => target.environment), ["darwin-arm64", "windows-x64", "linux-x64"]);
  assert.deepEqual([...new Set(candidate.targets.map((target) => target.productVersion))], ["0.99.0"]);
});

test("documentation check is structured and CI workflow runs every evidence producer before aggregation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nextclaw-portable-docs-"));
  const docs = path.join(directory, "docs.json");
  const result = run(["--verify-docs", "--output", docs]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(docs, "utf8")).checks, ["user-guide", "developer-contract", "commands", "distribution", "observability"]);

  const workflow = await readFile(path.join(root, ".github/workflows/portable-runtime-validate.yml"), "utf8");
  for (const required of [
    "public-github-runner-smoke.tools.mjs",
    "runtime-memory.tools.mjs",
    "portable-runtime-kernel-scenarios.tools.ts",
    "--kernel",
    "--verify-rust-wasi-scaffold",
    "--verify-docs",
    "--docs",
    "portable-runtime-ci-evidence.tools.ts",
    "aggregate-acceptance-evidence",
  ]) assert.match(workflow, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(workflow, /planned stable nextclaw Changesets release/);
  assert.match(workflow, /--product-version "\$\{\{ needs\.select-matrix\.outputs\.product_version \}\}"/);
  const smoke = await readFile(path.join(root, "packages/nextclaw/scripts/verify-portable-runtime-http-smoke.mjs"), "utf8");
  assert.match(smoke, /app", "disable", "nextclaw\.generated-counter/);
  assert.match(smoke, /app", "enable", "nextclaw\.generated-counter/);
});

test("Kernel scenario producer executes durable event, Job, stream and Provider assertions before signing checks", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nextclaw-portable-kernel-scenarios-test-"));
  const output = path.join(directory, "kernel.json");
  const result = spawnSync("pnpm", ["-C", "packages/nextclaw", "exec", "tsx", "--tsconfig", "../nextclaw-kernel/tsconfig.json", kernelScenarioTool, "--output", output], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const artifact = JSON.parse(await readFile(output, "utf8"));
  assert.deepEqual(artifact.checks, ["event-dedupe", "event-cursor-order", "job-recovery", "stream-disconnect-limit", "provider-version-incompatible"]);
  assert.equal(artifact.observations.jobs.recoveredStatus, "interrupted");
  assert.equal(artifact.observations.jobs.retainedEvents, 256);
  assert.equal(artifact.observations.component.bindRejected, true);
});
