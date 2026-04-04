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

const workspacePackages = collectWorkspacePackages();
const pendingChangesetPackages = readPendingChangesetPackages();
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

const publishedBatchPackages = batchPackages.filter((entry) => isPackageVersionPublished(entry));
const missingBatchPackages = batchPackages.filter((entry) => !isPackageVersionPublished(entry));

if (healthDriftFailures.length === 0 && batchPackages.length === 0) {
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

if (batchPackages.length > 0) {
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

process.exit(0);
