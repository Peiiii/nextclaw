import {
  collectWorkspacePackages,
  getExpectedPublishGuardCommand,
  getExplicitReleaseBatchPackageNames,
  readPendingChangesetPackages
} from "./release-scope.mjs";

const workspacePackages = collectWorkspacePackages();
const pendingChangesetPackages = readPendingChangesetPackages();
const batchPackageNames = getExplicitReleaseBatchPackageNames(
  workspacePackages,
  pendingChangesetPackages
);

const batchPackages = workspacePackages.filter(
  (entry) => entry.private === false && batchPackageNames.has(entry.pkg.name)
);

const publishGuardFailures = batchPackages
  .map((entry) => {
    const expectedCommand = getExpectedPublishGuardCommand(entry);
    const actualCommand = entry.pkg.scripts?.prepublishOnly ?? null;
    return {
      packageFile: entry.packageFile,
      expectedCommand,
      actualCommand
    };
  })
  .filter((entry) => entry.actualCommand !== entry.expectedCommand);

if (publishGuardFailures.length > 0) {
  console.error("Publish guard check failed.");
  for (const failure of publishGuardFailures) {
    console.error(`- package: ${failure.packageFile}`);
    console.error(`  expected prepublishOnly: ${failure.expectedCommand}`);
    console.error(`  actual prepublishOnly: ${failure.actualCommand ?? "<missing>"}`);
  }
  process.exit(1);
}

console.log("Publish guard checks passed.");
