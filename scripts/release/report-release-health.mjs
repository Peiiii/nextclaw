import {
  collectWorkspacePackages,
  getExplicitReleaseBatchPackageNames,
  getPackageTagName,
  isPackageVersionPublished,
  readNpmRegistry,
  readMeaningfulReleaseDrift,
  readPendingChangesetPackages,
  resolveExplicitReleaseBatchPackages
} from "./release-scope.mjs";
import { execFileSync } from "node:child_process";

function readFlag(flag) {
  return process.argv.includes(flag);
}

function parseStableSemver(value) {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return match.slice(1).map((part) => Number(part));
}

function compareStableSemver(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function readLatestStableTagVersion(entry) {
  const prefix = `${entry.pkg.name}@`;
  const output = execFileSync("git", ["tag", "--list", `${prefix}*`], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
    .map((tagName) => tagName.slice(prefix.length))
    .map((version) => ({
      raw: version,
      parsed: parseStableSemver(version)
    }))
    .filter((version) => version.parsed)
    .sort((left, right) => compareStableSemver(right.parsed, left.parsed))[0]?.raw ?? null;
}

function isLocalVersionBehindLatestStableTag(entry) {
  const localVersion = parseStableSemver(entry.pkg.version);
  const latestTagVersion = readLatestStableTagVersion(entry);
  const latestVersion = latestTagVersion ? parseStableSemver(latestTagVersion) : null;
  if (!localVersion || !latestVersion) {
    return null;
  }
  if (compareStableSemver(localVersion, latestVersion) >= 0) {
    return null;
  }
  return {
    packageName: entry.pkg.name,
    localVersion: entry.pkg.version,
    latestTagVersion,
    packageFile: entry.packageFile
  };
}

const workspacePackages = collectWorkspacePackages();
const pendingChangesetPackages = readPendingChangesetPackages();
const failOnDrift = readFlag("--fail-on-drift");
const failOnBehindTags = readFlag("--fail-on-behind-tags");
const includeRegistry = !readFlag("--no-registry");
const batchPackageNames = getExplicitReleaseBatchPackageNames(
  workspacePackages,
  pendingChangesetPackages
);
const batchPackages = resolveExplicitReleaseBatchPackages(
  workspacePackages,
  pendingChangesetPackages
);

const healthDriftFailures = workspacePackages
  .filter((entry) => entry.private === false)
  .filter((entry) => !batchPackageNames.has(entry.pkg.name))
  .map((entry) => ({
    packageName: entry.pkg.name,
    version: entry.pkg.version,
    tagName: getPackageTagName(entry.pkg),
    changedFiles: readMeaningfulReleaseDrift(entry)
  }))
  .filter((entry) => entry.changedFiles.length > 0);

const versionLagFailures = workspacePackages
  .filter((entry) => entry.private === false)
  .map((entry) => isLocalVersionBehindLatestStableTag(entry))
  .filter(Boolean);

const publishedBatchPackages = includeRegistry
  ? batchPackages.filter((entry) => isPackageVersionPublished(entry))
  : [];
const missingBatchPackages = includeRegistry
  ? batchPackages.filter((entry) => !isPackageVersionPublished(entry))
  : [];

if (healthDriftFailures.length === 0 && versionLagFailures.length === 0 && batchPackages.length === 0) {
  console.log("Repository release health is clean.");
  process.exit(0);
}

if (healthDriftFailures.length === 0) {
  console.log("Repository release health is clean outside the current batch.");
} else {
  console.warn("Repository release health has unpublished drift outside the current batch.");
  for (const failure of healthDriftFailures) {
    console.warn(`- package: ${failure.packageName}@${failure.version}`);
    console.warn(`  tag: ${failure.tagName}`);
    console.warn("  changed files:");
    for (const changedFile of failure.changedFiles) {
      console.warn(`    - ${changedFile}`);
    }
  }
}

if (versionLagFailures.length === 0) {
  console.log("Workspace package versions are not behind latest stable release tags.");
} else {
  console.warn("Workspace package versions are behind latest stable release tags.");
  for (const failure of versionLagFailures) {
    console.warn(`- package: ${failure.packageName}`);
    console.warn(`  package file: ${failure.packageFile}`);
    console.warn(`  local version: ${failure.localVersion}`);
    console.warn(`  latest stable tag version: ${failure.latestTagVersion}`);
  }
}

if (includeRegistry && batchPackages.length > 0) {
  console.log(`Current release batch registry status (${readNpmRegistry()}):`);
  if (publishedBatchPackages.length > 0) {
    console.log("  already published on registry:");
    for (const entry of publishedBatchPackages) {
      console.log(`    - ${entry.pkg.name}@${entry.pkg.version}`);
    }
  }
  if (missingBatchPackages.length > 0) {
    console.log("  still missing on registry:");
    for (const entry of missingBatchPackages) {
      console.log(`    - ${entry.pkg.name}@${entry.pkg.version}`);
    }
  }
}

if (
  (failOnDrift && healthDriftFailures.length > 0) ||
  (failOnBehindTags && versionLagFailures.length > 0)
) {
  console.error("Release health check failed.");
  process.exit(1);
}

process.exit(0);
