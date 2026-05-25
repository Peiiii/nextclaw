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

const workspacePackageByName = new Map(
  workspacePackages.map((entry) => [entry.pkg.name, entry])
);

const privateWorkspaceDependencyFailures = workspacePackages
  .filter((entry) => entry.private === false)
  .flatMap((entry) => {
    const dependencies = entry.pkg.dependencies ?? {};
    return Object.entries(dependencies)
      .map(([dependencyName, dependencyVersion]) => {
        const dependencyEntry = workspacePackageByName.get(dependencyName);
        if (!dependencyEntry?.private || typeof dependencyVersion !== "string") {
          return null;
        }
        if (!dependencyVersion.startsWith("workspace:")) {
          return null;
        }
        return {
          dependencyName,
          dependencyPackageFile: dependencyEntry.packageFile,
          packageFile: entry.packageFile
        };
      })
      .filter(Boolean);
  });

if (publishGuardFailures.length > 0) {
  console.error("Publish guard check failed.");
  for (const failure of publishGuardFailures) {
    console.error(`- package: ${failure.packageFile}`);
    console.error(`  expected prepublishOnly: ${failure.expectedCommand}`);
    console.error(`  actual prepublishOnly: ${failure.actualCommand ?? "<missing>"}`);
  }
  process.exit(1);
}

if (privateWorkspaceDependencyFailures.length > 0) {
  console.error("Public package dependency closure check failed.");
  for (const failure of privateWorkspaceDependencyFailures) {
    console.error(`- package: ${failure.packageFile}`);
    console.error(
      `  depends on private workspace package: ${failure.dependencyName} (${failure.dependencyPackageFile})`
    );
  }
  process.exit(1);
}

console.log("Publish guard checks passed.");
