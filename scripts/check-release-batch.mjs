import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { performance } from "node:perf_hooks";
import {
  collectWorkspacePackages,
  readPendingChangesetPackages,
  resolveExplicitReleaseBatchPackages
} from "./release-scope.mjs";
import { resolveReleaseCheckpointPath } from "./release-checkpoints.mjs";

const ROOT_DIR = process.cwd();
const STEP_NAMES = ["build", "lint", "tsc"];
const ROOT_INPUT_CANDIDATES = [
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs"
];

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readCliFlag(flag) {
  return process.argv.includes(flag);
}

function resolveBatchPackages() {
  const workspacePackages = collectWorkspacePackages();
  const pendingChangesetPackages = readPendingChangesetPackages();
  return resolveExplicitReleaseBatchPackages(workspacePackages, pendingChangesetPackages);
}

function collectInternalDependencies(entry, batchPackageNames) {
  const dependencyFields = [
    entry.pkg.dependencies,
    entry.pkg.devDependencies,
    entry.pkg.optionalDependencies,
    entry.pkg.peerDependencies
  ];
  const dependencies = new Set();
  for (const field of dependencyFields) {
    if (!field || typeof field !== "object") {
      continue;
    }
    for (const packageName of Object.keys(field)) {
      if (batchPackageNames.has(packageName)) {
        dependencies.add(packageName);
      }
    }
  }
  return dependencies;
}

function sortBatchPackages(batchPackages) {
  const batchPackageNames = new Set(batchPackages.map((entry) => entry.pkg.name));
  const packageByName = new Map(batchPackages.map((entry) => [entry.pkg.name, entry]));
  const dependencyMap = new Map(
    batchPackages.map((entry) => [entry.pkg.name, collectInternalDependencies(entry, batchPackageNames)])
  );
  const pendingDependencyCount = new Map(
    batchPackages.map((entry) => [entry.pkg.name, dependencyMap.get(entry.pkg.name)?.size ?? 0])
  );
  const dependentsMap = new Map(batchPackages.map((entry) => [entry.pkg.name, []]));

  for (const [packageName, dependencies] of dependencyMap.entries()) {
    for (const dependencyName of dependencies) {
      dependentsMap.get(dependencyName)?.push(packageName);
    }
  }

  const queue = batchPackages
    .filter((entry) => (pendingDependencyCount.get(entry.pkg.name) ?? 0) === 0)
    .map((entry) => entry.pkg.name)
    .sort();
  const ordered = [];

  while (queue.length > 0) {
    const packageName = queue.shift();
    if (!packageName) {
      continue;
    }
    ordered.push(packageByName.get(packageName));
    for (const dependentName of dependentsMap.get(packageName) ?? []) {
      const nextCount = (pendingDependencyCount.get(dependentName) ?? 0) - 1;
      pendingDependencyCount.set(dependentName, nextCount);
      if (nextCount === 0) {
        queue.push(dependentName);
        queue.sort();
      }
    }
  }

  if (ordered.length !== batchPackages.length) {
    throw new Error(
      `release batch dependency graph contains a cycle: ${batchPackages.map((entry) => entry.pkg.name).join(", ")}`
    );
  }

  return {
    ordered,
    dependencyMap
  };
}

function listGitTrackedAndUntrackedFiles(relativePaths) {
  const stdout = execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "--deduplicate", "--", ...relativePaths],
    {
      cwd: ROOT_DIR,
      encoding: "utf8"
    }
  );
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

function shouldHashFile(filePath) {
  return !(
    filePath.includes("/node_modules/") ||
    filePath.includes("/dist/") ||
    filePath.includes("/coverage/") ||
    filePath.includes("/.turbo/") ||
    filePath.includes("/.cache/")
  );
}

function buildFilesFingerprint(relativePaths) {
  const hash = createHash("sha256");
  for (const relativePath of relativePaths.filter(shouldHashFile)) {
    const absolutePath = join(ROOT_DIR, relativePath);
    hash.update(relativePath);
    hash.update("\0");
    if (!existsSync(absolutePath)) {
      hash.update("<missing>");
      hash.update("\0");
      continue;
    }
    hash.update(readFileSync(absolutePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function resolveRootInputFiles() {
  return ROOT_INPUT_CANDIDATES.filter((relativePath) => existsSync(join(ROOT_DIR, relativePath)));
}

function buildPackageBaseFingerprint(entry, rootInputFiles) {
  const packageFiles = listGitTrackedAndUntrackedFiles([entry.packageDir]);
  return buildFilesFingerprint([...rootInputFiles, ...packageFiles]);
}

function buildPackageFingerprints(orderedBatchPackages, dependencyMap) {
  const rootInputFiles = resolveRootInputFiles();
  const baseFingerprints = new Map(
    orderedBatchPackages.map((entry) => [entry.pkg.name, buildPackageBaseFingerprint(entry, rootInputFiles)])
  );
  const fingerprints = new Map();

  for (const entry of orderedBatchPackages) {
    const dependencyFingerprintEntries = [...(dependencyMap.get(entry.pkg.name) ?? [])]
      .sort()
      .map((dependencyName) => `${dependencyName}:${fingerprints.get(dependencyName) ?? ""}`);
    fingerprints.set(
      entry.pkg.name,
      sha256([baseFingerprints.get(entry.pkg.name) ?? "", ...dependencyFingerprintEntries].join("\n"))
    );
  }

  return fingerprints;
}

function buildBatchId(orderedBatchPackages) {
  return sha256(
    orderedBatchPackages
      .map((entry) => `${entry.pkg.name}@${entry.pkg.version}`)
      .join("\n")
  ).slice(0, 16);
}

function resolveCheckpointPath(batchId) {
  return resolveReleaseCheckpointPath(batchId);
}

function createEmptyCheckpoint(batchId, orderedBatchPackages) {
  return {
    batchId,
    packages: Object.fromEntries(
      orderedBatchPackages.map((entry) => [
        entry.pkg.name,
        {
          version: entry.pkg.version,
          packageDir: entry.packageDir,
          steps: {}
        }
      ])
    )
  };
}

function readCheckpoint(batchId, orderedBatchPackages, reset) {
  const checkpointPath = resolveCheckpointPath(batchId);
  const emptyCheckpoint = createEmptyCheckpoint(batchId, orderedBatchPackages);
  if (reset || !existsSync(checkpointPath)) {
    return {
      checkpointPath,
      checkpoint: emptyCheckpoint
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(checkpointPath, "utf8"));
    const parsedPackages = parsed?.packages && typeof parsed.packages === "object" ? parsed.packages : {};
    return {
      checkpointPath,
      checkpoint: {
        ...emptyCheckpoint,
        ...parsed,
        packages: {
          ...emptyCheckpoint.packages,
          ...parsedPackages
        }
      }
    };
  } catch {
    return {
      checkpointPath,
      checkpoint: emptyCheckpoint
    };
  }
}

function saveCheckpoint(checkpointPath, checkpoint) {
  writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

function readStepCommand(entry, stepName) {
  return entry.pkg.scripts?.[stepName] ?? null;
}

function isStepCached(params) {
  const packageState = params.checkpoint.packages[params.entry.pkg.name];
  const stepState = packageState?.steps?.[params.stepName];
  return (
    stepState?.status === "passed" &&
    stepState.fingerprint === params.fingerprint &&
    stepState.command === params.command &&
    packageState.version === params.entry.pkg.version
  );
}

function recordStepState(params) {
  const packageState =
    params.checkpoint.packages[params.entry.pkg.name] ??
    (params.checkpoint.packages[params.entry.pkg.name] = {
      version: params.entry.pkg.version,
      packageDir: params.entry.packageDir,
      steps: {}
    });

  packageState.version = params.entry.pkg.version;
  packageState.packageDir = params.entry.packageDir;
  packageState.steps[params.stepName] = {
    status: params.status,
    command: params.command,
    fingerprint: params.fingerprint,
    finishedAt: new Date().toISOString(),
    durationMs: params.durationMs
  };
}

function runStep(params) {
  const command = readStepCommand(params.entry, params.stepName);
  if (!command) {
    console.log(
      `[release:check] skip ${params.entry.pkg.name} ${params.stepName} (no ${params.stepName} script in ${params.entry.packageFile})`
    );
    return;
  }

  if (
    isStepCached({
      checkpoint: params.checkpoint,
      entry: params.entry,
      stepName: params.stepName,
      fingerprint: params.fingerprint,
      command
    })
  ) {
    console.log(`[release:check] skip ${params.entry.pkg.name} ${params.stepName} (cached success)`);
    return;
  }

  console.log(`[release:check] start ${params.entry.pkg.name} ${params.stepName}`);
  const startedAt = performance.now();
  const result = spawnSync("pnpm", ["-C", params.entry.packageDir, params.stepName], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: process.env
  });
  const duration = performance.now() - startedAt;

  recordStepState({
    checkpoint: params.checkpoint,
    entry: params.entry,
    stepName: params.stepName,
    status: result.status === 0 ? "passed" : "failed",
    command,
    fingerprint: params.fingerprint,
    durationMs: duration
  });
  saveCheckpoint(params.checkpointPath, params.checkpoint);

  if (result.status !== 0) {
    console.error(
      `[release:check] failed ${params.entry.pkg.name} ${params.stepName} after ${formatDuration(duration)}`
    );
    process.exit(result.status ?? 1);
  }

  console.log(
    `[release:check] done ${params.entry.pkg.name} ${params.stepName} in ${formatDuration(duration)}`
  );
}

const resetCheckpoint = readCliFlag("--reset") || process.env.NEXTCLAW_RELEASE_CHECK_RESET === "1";
const { ordered: orderedBatchPackages, dependencyMap } = sortBatchPackages(resolveBatchPackages());

if (orderedBatchPackages.length === 0) {
  console.error(
    "No release batch packages found. Create a changeset or run `pnpm release:version` before `pnpm release:check`."
  );
  process.exit(1);
}

const batchId = buildBatchId(orderedBatchPackages);
const fingerprints = buildPackageFingerprints(orderedBatchPackages, dependencyMap);
const { checkpointPath, checkpoint } = readCheckpoint(batchId, orderedBatchPackages, resetCheckpoint);

console.log(
  `[release:check] batch packages: ${orderedBatchPackages.map((entry) => entry.pkg.name).join(", ")}`
);
console.log(`[release:check] checkpoint: ${relative(ROOT_DIR, checkpointPath).replaceAll("\\", "/")}`);
if (resetCheckpoint) {
  console.log("[release:check] reset checkpoint requested");
}

for (const entry of orderedBatchPackages) {
  const fingerprint = fingerprints.get(entry.pkg.name) ?? "";
  for (const stepName of STEP_NAMES) {
    runStep({
      checkpoint,
      checkpointPath,
      entry,
      stepName,
      fingerprint
    });
  }
}
