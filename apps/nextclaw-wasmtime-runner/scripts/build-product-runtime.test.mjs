import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import {
  buildPortableProductRuntime,
  createPortableRuntimeBuildPlan,
  syncArtifactAtomically,
} from "./build-product-runtime.mjs";

const GUEST_NAMES = [
  "state-lab",
  "capability-lab",
  "sqlite-lab",
  "resident-lab",
  "provider-lab",
  "composition-lab",
];

async function createPortableRuntimeFixture(root, source = "same-source") {
  const runnerRoot = join(root, "apps", "nextclaw-wasmtime-runner");
  const files = new Map([
    ["Cargo.toml", "[package]\nname = \"fixture\"\n"],
    ["Cargo.lock", "fixture-lock"],
    ["rust-toolchain.toml", "[toolchain]\nchannel = \"fixture\"\n"],
    ["src/main.rs", source],
    ["wit/portable-service.wit", "package fixture:runtime;"],
  ]);
  for (const guest of GUEST_NAMES) {
    files.set(`guests/${guest}/Cargo.toml`, `[package]\nname = "${guest}"\n`);
    files.set(`guests/${guest}/src/lib.rs`, source);
  }
  for (const [relativePath, contents] of files) {
    const path = join(runnerRoot, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
}

function createFakeBuild(counter, contents = "built-artifact", delayMs = 0) {
  return async (plan) => {
    counter.count += 1;
    if (delayMs > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    await mkdir(dirname(plan.runner.source), { recursive: true });
    await writeFile(plan.runner.source, `${contents}-runner`);
    for (const [index, guest] of plan.guests.entries()) {
      await mkdir(dirname(guest.source), { recursive: true });
      await writeFile(guest.source, `${contents}-guest-${index}`);
    }
  };
}

test("creates one shared runner and six guest artifact targets for macOS", () => {
  const workspaceRoot = resolve("/workspace");
  const plan = createPortableRuntimeBuildPlan({
    workspaceRoot,
    platform: "darwin",
    arch: "arm64",
  });

  assert.equal(plan.target, "darwin-arm64");
  assert.equal(plan.cargoTarget, "aarch64-apple-darwin");
  assert.equal(
    plan.runner.destination,
    join(
      workspaceRoot,
      "packages",
      "nextclaw",
      "resources",
      "native",
      "darwin-arm64",
      "nextclaw-wasmtime-runner",
    ),
  );
  assert.equal(plan.commands.length, 7);
  assert.deepEqual(plan.commands.at(-1), [
    "build",
    "--release",
    "--target",
    "aarch64-apple-darwin",
  ]);
  assert.equal(plan.guests.length, 6);
  assert.ok(plan.guests.every(({ destination }) => basename(destination) === "service.wasm"));
});

for (const [platform, arch, cargoTarget, executable] of [
  ["linux", "x64", "x86_64-unknown-linux-musl", "nextclaw-wasmtime-runner"],
  ["linux", "arm64", "aarch64-unknown-linux-gnu", "nextclaw-wasmtime-runner"],
  ["win32", "x64", "x86_64-pc-windows-msvc", "nextclaw-wasmtime-runner.exe"],
  ["darwin", "x64", "x86_64-apple-darwin", "nextclaw-wasmtime-runner"],
]) {
  test(`maps ${platform}-${arch} to its native Rust runner target`, () => {
    const plan = createPortableRuntimeBuildPlan({ workspaceRoot: "/workspace", platform, arch });
    assert.equal(plan.cargoTarget, cargoTarget);
    assert.ok(plan.runner.source.endsWith(join(cargoTarget, "release", executable)));
    assert.ok(plan.runner.destination.endsWith(join(`${platform}-${arch}`, executable)));
  });
}

test("rejects undeclared platform and architecture combinations", () => {
  assert.throws(
    () => createPortableRuntimeBuildPlan({ workspaceRoot: "/workspace", platform: "win32", arch: "arm64" }),
    /does not support target win32-arm64/,
  );
});

test("atomically replaces a previously installed runner resource", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-portable-build-"));
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  const source = join(directory, "source-runner");
  const destination = join(directory, "native", "nextclaw-wasmtime-runner");
  await writeFile(source, "new-runner");
  await mkdir(join(directory, "native"), { recursive: true });
  await writeFile(destination, "old-runner");

  const result = await syncArtifactAtomically(source, destination, true);

  assert.equal(await readFile(destination, "utf8"), "new-runner");
  assert.equal(result.bytes, 10);
});

test("reuses unchanged portable runtime artifacts across worktrees without Cargo", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-portable-cache-"));
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  const firstWorkspace = join(directory, "worktree-a");
  const secondWorkspace = join(directory, "worktree-b");
  const cacheRoot = join(directory, "shared-cache");
  await createPortableRuntimeFixture(firstWorkspace);
  await createPortableRuntimeFixture(secondWorkspace);
  const counter = { count: 0 };

  const first = await buildPortableProductRuntime({
    workspaceRoot: firstWorkspace,
    platform: "darwin",
    arch: "arm64",
    cacheRoot,
    toolchainIdentity: "fixture-toolchain",
    executeBuild: createFakeBuild(counter),
  });
  const second = await buildPortableProductRuntime({
    workspaceRoot: secondWorkspace,
    platform: "darwin",
    arch: "arm64",
    cacheRoot,
    toolchainIdentity: "fixture-toolchain",
    executeBuild: createFakeBuild(counter, "must-not-run"),
  });

  assert.equal(first.cache.status, "miss");
  assert.equal(second.cache.status, "hit");
  assert.equal(counter.count, 1);
  assert.equal(await readFile(second.runner.destination, "utf8"), "built-artifact-runner");
});

test("invalidates the shared cache when a runner input changes", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-portable-cache-input-"));
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  const firstWorkspace = join(directory, "worktree-a");
  const secondWorkspace = join(directory, "worktree-b");
  const cacheRoot = join(directory, "shared-cache");
  await createPortableRuntimeFixture(firstWorkspace, "source-a");
  await createPortableRuntimeFixture(secondWorkspace, "source-b");
  const counter = { count: 0 };

  const first = await buildPortableProductRuntime({
    workspaceRoot: firstWorkspace,
    platform: "darwin",
    arch: "arm64",
    cacheRoot,
    toolchainIdentity: "fixture-toolchain",
    executeBuild: createFakeBuild(counter, "first"),
  });
  const second = await buildPortableProductRuntime({
    workspaceRoot: secondWorkspace,
    platform: "darwin",
    arch: "arm64",
    cacheRoot,
    toolchainIdentity: "fixture-toolchain",
    executeBuild: createFakeBuild(counter, "second"),
  });

  assert.equal(first.cache.status, "miss");
  assert.equal(second.cache.status, "miss");
  assert.notEqual(first.cache.fingerprint, second.cache.fingerprint);
  assert.equal(counter.count, 2);
});

test("invalidates the shared cache when the Rust toolchain identity changes", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-portable-cache-toolchain-"));
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  const workspace = join(directory, "worktree");
  const cacheRoot = join(directory, "shared-cache");
  await createPortableRuntimeFixture(workspace);
  const counter = { count: 0 };

  const first = await buildPortableProductRuntime({
    workspaceRoot: workspace,
    platform: "darwin",
    arch: "arm64",
    cacheRoot,
    toolchainIdentity: "fixture-toolchain-a",
    executeBuild: createFakeBuild(counter, "first"),
  });
  const second = await buildPortableProductRuntime({
    workspaceRoot: workspace,
    platform: "darwin",
    arch: "arm64",
    cacheRoot,
    toolchainIdentity: "fixture-toolchain-b",
    executeBuild: createFakeBuild(counter, "second"),
  });

  assert.notEqual(first.cache.fingerprint, second.cache.fingerprint);
  assert.equal(counter.count, 2);
});

test("rebuilds instead of restoring a corrupted shared artifact", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-portable-cache-corrupt-"));
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  const firstWorkspace = join(directory, "worktree-a");
  const secondWorkspace = join(directory, "worktree-b");
  const cacheRoot = join(directory, "shared-cache");
  await createPortableRuntimeFixture(firstWorkspace);
  await createPortableRuntimeFixture(secondWorkspace);
  const counter = { count: 0 };

  const first = await buildPortableProductRuntime({
    workspaceRoot: firstWorkspace,
    platform: "darwin",
    arch: "arm64",
    cacheRoot,
    toolchainIdentity: "fixture-toolchain",
    executeBuild: createFakeBuild(counter, "first"),
  });
  await writeFile(join(first.cache.directory, "artifacts", "runner"), "tampered");
  const second = await buildPortableProductRuntime({
    workspaceRoot: secondWorkspace,
    platform: "darwin",
    arch: "arm64",
    cacheRoot,
    toolchainIdentity: "fixture-toolchain",
    executeBuild: createFakeBuild(counter, "repaired"),
  });

  assert.equal(second.cache.status, "miss");
  assert.equal(counter.count, 2);
  assert.equal(await readFile(second.runner.destination, "utf8"), "repaired-runner");
});

test("serializes concurrent builds for the same fingerprint", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-portable-cache-lock-"));
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  const firstWorkspace = join(directory, "worktree-a");
  const secondWorkspace = join(directory, "worktree-b");
  const cacheRoot = join(directory, "shared-cache");
  await createPortableRuntimeFixture(firstWorkspace);
  await createPortableRuntimeFixture(secondWorkspace);
  const counter = { count: 0 };

  const [first, second] = await Promise.all([
    buildPortableProductRuntime({
      workspaceRoot: firstWorkspace,
      platform: "darwin",
      arch: "arm64",
      cacheRoot,
      toolchainIdentity: "fixture-toolchain",
      executeBuild: createFakeBuild(counter, "shared", 80),
      cacheWaitIntervalMs: 10,
    }),
    buildPortableProductRuntime({
      workspaceRoot: secondWorkspace,
      platform: "darwin",
      arch: "arm64",
      cacheRoot,
      toolchainIdentity: "fixture-toolchain",
      executeBuild: createFakeBuild(counter, "must-not-run"),
      cacheWaitIntervalMs: 10,
    }),
  ]);

  assert.equal(counter.count, 1);
  assert.deepEqual(new Set([first.cache.status, second.cache.status]), new Set(["miss", "wait-hit"]));
});

test("development validation reuses the exact native Rust target build", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/portable-runtime-validate.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /uses: actions\/cache@v4/);
  assert.match(workflow, /apps\/nextclaw-wasmtime-runner\/target/);
  assert.match(workflow, /cargo test --release --target \$\{\{ matrix\.cargo_target \}\}/);
});

test("focused platform validation does not invoke the three-platform aggregate gate", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/portable-runtime-validate.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /target: \$\{\{ steps\.select\.outputs\.target \}\}/);
  assert.match(workflow, /echo "target=\$TARGET" >> "\$GITHUB_OUTPUT"/);
  assert.match(
    workflow,
    /aggregate-acceptance-evidence:[\s\S]*?if: \$\{\{ needs\.select-matrix\.outputs\.target == 'all' \}\}/,
  );
});
