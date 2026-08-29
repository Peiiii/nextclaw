import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPublishedNpmPackageArchive } from "./verify-published-npm-package.mjs";
import { UiDistPrecompressionManager } from "./managers/ui-dist-precompression.manager.mjs";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(packageRoot, "../..");
const REPO = "Peiiii/nextclaw";
const REGISTRY_VISIBILITY_ATTEMPTS = 6;
const REGISTRY_VISIBILITY_RETRY_MS = 5_000;

function readArgValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1]?.trim() || null : null;
}

function log(message) {
  console.log(`[verify:published-npm-runtime-update] ${message}`);
}

function run(command, args, options = {}) {
  log(`running ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
    timeout: options.timeout ?? 120000,
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `command failed: ${command} ${args.join(" ")}`,
        result.error ? String(result.error) : "",
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function readVersionOutput(stdout, description) {
  const versions = stdout
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(line));
  const version = versions.at(-1);
  assert(version, `${description} did not print a semantic version:\n${stdout.trim()}`);
  return version;
}

export function isRegistryVisibilityError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(?:ETARGET|E404)\b|No matching version found|Not Found/i.test(message);
}

export function resolvePublishedRuntimeAsset(version, platform, arch) {
  assert(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version),
    `invalid published Runtime version: ${version}`,
  );
  const assetName = `nextclaw-runtime-${platform}-${arch}-${version}.zip`;
  const releaseTag = `nextclaw@${version}`;
  return {
    assetName,
    releaseTag,
    url: `https://github.com/${REPO}/releases/download/${releaseTag}/${assetName}`,
  };
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

export async function runPublishedNpmRuntimeUpdateValidation(argv) {
  if (argv.includes("--published-beta")) {
    await verifyPublishedBetaRelease();
    return true;
  }
  if (argv.includes("--published-stable")) {
    await verifyPublishedStableRelease(argv);
    return true;
  }
  return false;
}

async function verifyPublishedBetaRelease() {
  const fixture = await createPublishedInstallFixture("nextclaw@beta", "beta");
  try {
    verifyPublishedBetaInstall(fixture);
    log("published beta install smoke passed");
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
}

async function verifyPublishedStableRelease(argv) {
  const expectedVersion = readArgValue(argv, "--expected-version");
  const previousVersion = readArgValue(argv, "--previous-version");
  const packageOnly = argv.includes("--package-only");
  const updateOnly = argv.includes("--update-only");
  assert(expectedVersion, "--published-stable requires --expected-version");
  if (packageOnly) {
    await verifyPublishedNpmPackageArchive({ expectedVersion, run });
    log("published stable registry payload passed");
    return;
  }
  if (updateOnly) {
    assert(previousVersion, "--update-only requires --previous-version");
    await verifyPreviousStableUpdate(previousVersion, expectedVersion);
    log("published stable update smoke passed");
    return;
  }
  const fixture = await createPublishedInstallFixture(
    resolveStablePackageTarball(expectedVersion),
    `stable-${expectedVersion}`,
  );
  try {
    verifyPublishedStableInstall(fixture, expectedVersion);
    verifyPublishedPortableRuntimeHttp(fixture);
    if (previousVersion) {
      await verifyPreviousStableUpdate(previousVersion, expectedVersion);
    }
    log("published stable install smoke passed");
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
}

async function verifyPreviousStableUpdate(previousVersion, expectedVersion) {
  assert(
    previousVersion !== expectedVersion,
    "--previous-version must differ from --expected-version",
  );
  const fixture = await createPublishedInstallFixture(
    resolveStablePackageTarball(previousVersion),
    `stable-upgrade-${previousVersion}`,
  );
  try {
    verifyPublishedStableUpdate(fixture, previousVersion, expectedVersion);
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
}

function resolveStablePackageTarball(version) {
  assert(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version),
    `invalid stable package version: ${version}`,
  );
  return `https://registry.npmjs.org/nextclaw/-/nextclaw-${version}.tgz`;
}

async function createPublishedInstallFixture(packageSpec, label) {
  const tempRoot = await mkdtemp(
    join(tmpdir(), `nextclaw-published-${label}-smoke-`),
  );
  const prefix = join(tempRoot, "prefix");
  mkdirSync(prefix, { recursive: true });
  const installArgs = [
    "install",
    "-g",
    packageSpec,
    "--prefix",
    prefix,
    "--no-audit",
    "--no-fund",
    "--prefer-online",
  ];
  const installOptions = {
    cwd: tempRoot,
    env: { npm_config_cache: join(tempRoot, "npm-cache") },
    timeout: 300000,
  };
  for (let attempt = 1; attempt <= REGISTRY_VISIBILITY_ATTEMPTS; attempt += 1) {
    try {
      run("npm", installArgs, installOptions);
      break;
    } catch (error) {
      if (
        attempt === REGISTRY_VISIBILITY_ATTEMPTS ||
        !isRegistryVisibilityError(error)
      ) {
        throw error;
      }
      log(
        `registry metadata is not visible yet; retrying install (${attempt}/${REGISTRY_VISIBILITY_ATTEMPTS})`,
      );
      await sleep(REGISTRY_VISIBILITY_RETRY_MS);
    }
  }
  return {
    binaryPath: join(prefix, "bin/nextclaw"),
    packageDirectory: join(prefix, "lib/node_modules/nextclaw"),
    prefix,
    nextclawHome: join(tempRoot, "home"),
    tempRoot,
  };
}

function verifyPublishedBetaInstall(fixture) {
  const expectedVersion = JSON.parse(
    run("npm", ["view", "nextclaw@beta", "version", "--json"]).stdout.trim(),
  );
  const installedVersion = verifyPublishedPackagePayload(
    fixture,
    expectedVersion,
  );
  const apiProbe = run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        "import { InputBudgetPruner } from '@nextclaw/core';",
        "const pruner = new InputBudgetPruner();",
        "console.log(JSON.stringify({ estimateType: typeof pruner.estimate, pruneType: typeof pruner.prune }));",
      ].join(" "),
    ],
    { cwd: fixture.packageDirectory },
  );
  const apiSnapshot = JSON.parse(apiProbe.stdout.trim());
  assert(
    apiSnapshot.estimateType === "function",
    `expected estimate() to exist, got ${apiSnapshot.estimateType}`,
  );
  assert(
    apiSnapshot.pruneType === "function",
    `expected prune() to exist, got ${apiSnapshot.pruneType}`,
  );

  console.log(`
[validation:npm-update --published-beta] Published beta install verified.

- installed binary: ${fixture.binaryPath}
- installed version: ${installedVersion}
- InputBudgetPruner.estimate: ${apiSnapshot.estimateType}
- InputBudgetPruner.prune: ${apiSnapshot.pruneType}
`);
}

function verifyPublishedStableInstall(fixture, expectedVersion) {
  const installedVersion = verifyPublishedPackagePayload(
    fixture,
    expectedVersion,
  );
  console.log(`
[validation:npm-update --published-stable] Published stable package verified.

- installed binary: ${fixture.binaryPath}
- installed version: ${installedVersion}
- app entry: present
- launcher entry: present
- update public key: present
- embedded UI: present
`);
}

function verifyPublishedPackagePayload(fixture, expectedVersion) {
  const installedVersion = JSON.parse(
    readFileSync(join(fixture.packageDirectory, "package.json"), "utf8"),
  ).version;
  assert(
    installedVersion === expectedVersion,
    `expected nextclaw ${expectedVersion}, got ${installedVersion}`,
  );
  for (const relativePath of [
    "dist/cli/app/index.js",
    "dist/cli/launcher/index.js",
    "resources/update-bundle-public.pem",
    "ui-dist/index.html",
  ]) {
    assert(
      existsSync(join(fixture.packageDirectory, relativePath)),
      `published nextclaw is missing ${relativePath}`,
    );
  }
  new UiDistPrecompressionManager({
    rootDir: join(fixture.packageDirectory, "ui-dist"),
  }).verify();
  return installedVersion;
}

function verifyPublishedPortableRuntimeHttp(fixture) {
  run(process.execPath, [
    resolve(packageRoot, "scripts/verify-portable-runtime-http-smoke.mjs"),
    "--binary",
    fixture.binaryPath,
    "--home",
    fixture.nextclawHome,
    "--cwd",
    fixture.packageDirectory,
  ], {
    cwd: fixture.packageDirectory,
    env: {
      NEXTCLAW_HOME: fixture.nextclawHome,
      PATH: `${fixture.prefix}/bin:${process.env.PATH ?? ""}`,
    },
    timeout: 300000,
  });
}

function parsePublishedLauncherJson(fixture, args) {
  const stdout = run(fixture.binaryPath, args, {
    cwd: fixture.packageDirectory,
    env: {
      NEXTCLAW_HOME: fixture.nextclawHome,
      PATH: `${fixture.prefix}/bin:${process.env.PATH ?? ""}`,
    },
    timeout: 300000,
  }).stdout.trim();
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `published launcher command did not print JSON:\n${stdout}\n${String(error)}`,
    );
  }
}

function seedPreviousPublishedRuntime(fixture, previousVersion) {
  const asset = resolvePublishedRuntimeAsset(
    previousVersion,
    process.platform,
    process.arch,
  );
  const downloadPath = join(fixture.tempRoot, asset.assetName);
  const extractPath = join(fixture.tempRoot, "previous-runtime");
  run("curl", ["--fail", "--location", "--output", downloadPath, asset.url], {
    cwd: fixture.tempRoot,
    timeout: 300000,
  });
  run("unzip", ["-q", downloadPath, "-d", extractPath], {
    cwd: fixture.tempRoot,
    timeout: 300000,
  });
  const sourceBundle = join(extractPath, "bundle");
  const manifest = JSON.parse(
    readFileSync(join(sourceBundle, "manifest.json"), "utf8"),
  );
  assert(
    manifest.runtimeVersion === previousVersion &&
      manifest.platform === process.platform &&
      manifest.arch === process.arch,
    `previous Runtime asset identity mismatch: ${JSON.stringify(manifest)}`,
  );
  const bundleDirectory = join(
    fixture.nextclawHome,
    "launcher",
    "runtime-bundles",
    "versions",
    previousVersion,
  );
  mkdirSync(bundleDirectory, { recursive: true });
  cpSync(sourceBundle, bundleDirectory, { recursive: true, force: true });
  const pointerPath = join(
    fixture.nextclawHome,
    "launcher",
    "runtime-bundles",
    "current.json",
  );
  writeFileSync(pointerPath, `${JSON.stringify({ version: previousVersion }, null, 2)}\n`);
}

function verifyPublishedStableUpdate(
  fixture,
  previousVersion,
  expectedVersion,
) {
  seedPreviousPublishedRuntime(fixture, previousVersion);
  const checkSnapshot = parsePublishedLauncherJson(fixture, [
    "update",
    "--channel",
    "stable",
    "--check",
    "--json",
  ]);
  assert(
    checkSnapshot.status === "update-available",
    `expected update-available, got ${checkSnapshot.status}`,
  );
  assert(
    checkSnapshot.availableVersion === expectedVersion,
    `expected available version ${expectedVersion}`,
  );

  const currentPointerPath = join(
    fixture.nextclawHome,
    "launcher",
    "runtime-bundles",
    "current.json",
  );
  const downloadedSnapshot = parsePublishedLauncherJson(fixture, [
    "update",
    "--channel",
    "stable",
    "--download-only",
    "--json",
  ]);
  assert(
    downloadedSnapshot.status === "downloaded",
    `expected downloaded, got ${downloadedSnapshot.status}`,
  );
  const pointerBeforeApply = JSON.parse(readFileSync(currentPointerPath, "utf8"));
  assert(
    pointerBeforeApply.version === previousVersion,
    "download-only unexpectedly switched the current runtime pointer",
  );

  const appliedSnapshot = parsePublishedLauncherJson(fixture, [
    "update",
    "--apply",
    "--json",
  ]);
  assert(
    appliedSnapshot.status === "restart-required",
    `expected restart-required, got ${appliedSnapshot.status}`,
  );
  assert(
    existsSync(currentPointerPath),
    "apply did not create the current runtime pointer",
  );

  const upgradedVersion = readVersionOutput(
    run(fixture.binaryPath, ["--version"], {
      cwd: fixture.packageDirectory,
      env: {
        NEXTCLAW_HOME: fixture.nextclawHome,
        PATH: `${fixture.prefix}/bin:${process.env.PATH ?? ""}`,
      },
      timeout: 300000,
    }).stdout,
    "updated nextclaw runtime",
  );
  assert(
    upgradedVersion === expectedVersion,
    `expected upgraded runtime ${expectedVersion}, got ${upgradedVersion}`,
  );
  const installedRuntimeRoot = join(
    fixture.nextclawHome,
    "launcher",
    "runtime-bundles",
    "versions",
    expectedVersion,
    "runtime",
  );
  const runnerPath = join(
    installedRuntimeRoot,
    "resources",
    "native",
    `${process.platform}-${process.arch}`,
    process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner",
  );
  assert(existsSync(runnerPath), `published runtime is missing Portable Service App runner: ${runnerPath}`);
  if (process.platform !== "win32") {
    accessSync(runnerPath, constants.X_OK);
  }
  const stateServicePath = join(
    installedRuntimeRoot,
    "resources",
    "apps",
    "nextclaw-portable-runtime-lab",
    "service-components",
    "nextclaw-portable-runtime-lab-state",
  );
  const callResult = JSON.parse(run(fixture.binaryPath, [
    "app",
    "call",
    stateServicePath,
    "counter_read",
    "--json",
  ], {
    cwd: fixture.packageDirectory,
    env: {
      NEXTCLAW_HOME: fixture.nextclawHome,
      PATH: `${fixture.prefix}/bin:${process.env.PATH ?? ""}`,
    },
    timeout: 300000,
  }).stdout.trim());
  assert(callResult.ok === true, `published Portable Service App call failed: ${JSON.stringify(callResult)}`);

  console.log(`
[validation:npm-update --published-stable] Published stable update verified.

- previous package: ${previousVersion}
- available version: ${checkSnapshot.availableVersion}
- download-only: did not switch current pointer
- apply: ${appliedSnapshot.status}
- new process version: ${upgradedVersion}
- Portable Service App runner: executable
- Portable Service App call: ${callResult.actionId}
`);
}
