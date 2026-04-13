import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT_DIR = process.cwd();
const ROOT_INPUT_CANDIDATES = [
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs"
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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
    dependencyMap,
    dependentsMap
  };
}

function buildPackagePriorityScores(orderedBatchPackages, dependentsMap) {
  const memo = new Map();

  function score(packageName) {
    if (memo.has(packageName)) {
      return memo.get(packageName);
    }
    const dependentScores = (dependentsMap.get(packageName) ?? []).map(score);
    const value = 1 + (dependentScores.length > 0 ? Math.max(...dependentScores) : 0);
    memo.set(packageName, value);
    return value;
  }

  for (const entry of orderedBatchPackages) {
    score(entry.pkg.name);
  }

  return memo;
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
    filePath.includes("/ui-dist/") ||
    filePath.endsWith("/resources/USAGE.md") ||
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
    orderedBatchPackages.map((entry) => `${entry.pkg.name}@${entry.pkg.version}`).join("\n")
  ).slice(0, 16);
}

export function planReleaseCheckBatch(batchPackages) {
  const {
    ordered: orderedBatchPackages,
    dependencyMap,
    dependentsMap
  } = sortBatchPackages(batchPackages);

  return {
    batchId: buildBatchId(orderedBatchPackages),
    dependencyMap,
    fingerprints: buildPackageFingerprints(orderedBatchPackages, dependencyMap),
    orderedBatchPackages,
    priorityScores: buildPackagePriorityScores(orderedBatchPackages, dependentsMap)
  };
}
