import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  createPortableRuntimeBuildPlan,
  syncArtifactAtomically,
} from "./build-product-runtime.mjs";

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
