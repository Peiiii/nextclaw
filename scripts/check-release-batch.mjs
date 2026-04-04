import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import {
  collectWorkspacePackages,
  readPendingChangesetPackages,
  resolveExplicitReleaseBatchPackages
} from "./release-scope.mjs";

const STEP_NAMES = ["build", "lint", "tsc"];

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
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

  return ordered;
}

function runStep(entry, stepName) {
  const command = entry.pkg.scripts?.[stepName];
  if (!command) {
    console.log(
      `[release:check] skip ${entry.pkg.name} ${stepName} (no ${stepName} script in ${entry.packageFile})`
    );
    return;
  }

  console.log(`[release:check] start ${entry.pkg.name} ${stepName}`);
  const startedAt = performance.now();
  const result = spawnSync("pnpm", ["-C", entry.packageDir, stepName], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env
  });
  const duration = performance.now() - startedAt;
  if (result.status !== 0) {
    console.error(
      `[release:check] failed ${entry.pkg.name} ${stepName} after ${formatDuration(duration)}`
    );
    process.exit(result.status ?? 1);
  }
  console.log(
    `[release:check] done ${entry.pkg.name} ${stepName} in ${formatDuration(duration)}`
  );
}

const batchPackages = sortBatchPackages(resolveBatchPackages());

if (batchPackages.length === 0) {
  console.error(
    "No release batch packages found. Create a changeset or run `pnpm release:version` before `pnpm release:check`."
  );
  process.exit(1);
}

console.log(
  `[release:check] batch packages: ${batchPackages.map((entry) => entry.pkg.name).join(", ")}`
);

for (const entry of batchPackages) {
  for (const stepName of STEP_NAMES) {
    runStep(entry, stepName);
  }
}
