#!/usr/bin/env node

import { chmod, copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const runnerRoot = resolve(dirname(scriptPath), "..");
const workspaceRoot = resolve(runnerRoot, "../..");

const GUESTS = [
  ["state-lab", "nextclaw_portable_runtime_state.wasm", "nextclaw-portable-runtime-lab-state"],
  ["capability-lab", "nextclaw_portable_runtime_capabilities.wasm", "nextclaw-portable-runtime-lab-capabilities"],
  ["resident-lab", "nextclaw_portable_runtime_resident.wasm", "nextclaw-portable-runtime-lab-resident"],
  ["provider-lab", "nextclaw_portable_runtime_provider.wasm", "nextclaw-portable-runtime-lab-provider"],
  ["composition-lab", "nextclaw_portable_runtime_composition.wasm", "nextclaw-portable-runtime-lab-composition"],
];

const RUNNER_TARGETS = new Map([
  ["darwin-arm64", { cargoTarget: "aarch64-apple-darwin", executable: "nextclaw-wasmtime-runner" }],
  ["darwin-x64", { cargoTarget: "x86_64-apple-darwin", executable: "nextclaw-wasmtime-runner" }],
  ["linux-arm64", { cargoTarget: "aarch64-unknown-linux-gnu", executable: "nextclaw-wasmtime-runner" }],
  ["linux-x64", { cargoTarget: "x86_64-unknown-linux-musl", executable: "nextclaw-wasmtime-runner" }],
  ["win32-x64", { cargoTarget: "x86_64-pc-windows-msvc", executable: "nextclaw-wasmtime-runner.exe" }],
]);

export function createPortableRuntimeBuildPlan(options = {}) {
  const root = resolve(options.workspaceRoot ?? workspaceRoot);
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const target = `${platform}-${arch}`;
  const runnerTarget = RUNNER_TARGETS.get(target);
  if (!runnerTarget) {
    throw new Error(`Portable Runtime product build does not support target ${target}.`);
  }

  const sourceRoot = join(root, "apps", "nextclaw-wasmtime-runner");
  const appRoot = join(root, "packages", "nextclaw", "resources", "apps", "nextclaw-portable-runtime-lab");
  return {
    target,
    cargoTarget: runnerTarget.cargoTarget,
    sourceRoot,
    runner: {
      source: join(
        sourceRoot,
        "target",
        runnerTarget.cargoTarget,
        "release",
        runnerTarget.executable,
      ),
      destination: join(
        root,
        "packages",
        "nextclaw",
        "resources",
        "native",
        target,
        runnerTarget.executable,
      ),
    },
    commands: [
      ...GUESTS.map(([guest]) => [
        "component",
        "build",
        "--manifest-path",
        join("guests", guest, "Cargo.toml"),
        "--release",
      ]),
      ["build", "--release", "--target", runnerTarget.cargoTarget],
    ],
    guests: GUESTS.map(([, artifact, componentId]) => ({
      source: join(sourceRoot, "target", "wasm32-wasip1", "release", artifact),
      destination: join(appRoot, "service-components", componentId, "service.wasm"),
    })),
  };
}

function runCargo(args, cwd) {
  console.log(`[portable-runtime] cargo ${args.join(" ")}`);
  const result = spawnSync("cargo", args, { cwd, env: process.env, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Portable Runtime build failed: cargo ${args.join(" ")}`);
  }
}

export async function syncArtifactAtomically(source, destination, executable = false) {
  await mkdir(dirname(destination), { recursive: true });
  const temporaryPath = `${destination}.tmp-${process.pid}-${Date.now()}`;
  try {
    await copyFile(source, temporaryPath);
    if (executable) {
      await chmod(temporaryPath, 0o755);
    }
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
  return { destination, bytes: (await stat(destination)).size };
}

export async function buildPortableProductRuntime(options = {}) {
  const plan = createPortableRuntimeBuildPlan(options);
  for (const args of plan.commands) runCargo(args, plan.sourceRoot);
  const runner = await syncArtifactAtomically(plan.runner.source, plan.runner.destination, true);
  const guests = [];
  for (const artifact of plan.guests) {
    guests.push(await syncArtifactAtomically(artifact.source, artifact.destination));
  }
  return { target: plan.target, runner, guests };
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const optionValue = (name) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  console.log(JSON.stringify(await buildPortableProductRuntime({
    platform: optionValue("--platform"),
    arch: optionValue("--arch"),
  }), null, 2));
}
