import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT_DIR = process.cwd();
const RELEASE_CHECKPOINT_DIR = join(ROOT_DIR, "tmp", "release-checkpoints");

function parseReleaseCheckpoint(checkpointPath) {
  const parsed = JSON.parse(readFileSync(checkpointPath, "utf8"));
  const packages =
    parsed?.packages && typeof parsed.packages === "object" ? parsed.packages : null;
  if (!parsed?.batchId || !packages) {
    return null;
  }
  return {
    batchId: parsed.batchId,
    packages
  };
}

export function resolveReleaseCheckpointPath(batchId) {
  mkdirSync(RELEASE_CHECKPOINT_DIR, { recursive: true });
  return join(RELEASE_CHECKPOINT_DIR, `${batchId}.json`);
}

export function listReleaseCheckpoints() {
  if (!existsSync(RELEASE_CHECKPOINT_DIR)) {
    return [];
  }

  return readdirSync(RELEASE_CHECKPOINT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const checkpointPath = join(RELEASE_CHECKPOINT_DIR, entry.name);
      const checkpoint = parseReleaseCheckpoint(checkpointPath);
      if (!checkpoint) {
        return null;
      }
      return {
        checkpointPath,
        modifiedAtMs: statSync(checkpointPath).mtimeMs,
        checkpoint
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs);
}

export function readLatestReleaseCheckpoint() {
  return listReleaseCheckpoints()[0] ?? null;
}

export function resolveCheckpointReleaseBatchPackages(workspacePackages, checkpointRecord) {
  if (!checkpointRecord) {
    return [];
  }

  const workspaceEntriesByName = new Map(
    workspacePackages.map((entry) => [entry.pkg.name, entry])
  );

  return Object.entries(checkpointRecord.checkpoint.packages).map(
    ([packageName, packageState]) => {
      const workspaceEntry = workspaceEntriesByName.get(packageName);
      return {
        ...(workspaceEntry ?? {}),
        private: false,
        packageDir: packageState.packageDir ?? workspaceEntry?.packageDir ?? null,
        absolutePackageDir: workspaceEntry?.absolutePackageDir ?? null,
        packageFile: workspaceEntry?.packageFile ?? null,
        pkg: {
          ...(workspaceEntry?.pkg ?? {}),
          name: packageName,
          version: packageState.version
        }
      };
    }
  );
}
