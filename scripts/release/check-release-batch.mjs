import { availableParallelism } from "node:os";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import {
  collectWorkspacePackages,
  readPendingChangesetPackages,
  resolveExplicitReleaseBatchPackages
} from "./release-scope.mjs";
import {
  readLatestReleaseCheckpoint,
  resolveCheckpointReleaseBatchPackages,
  resolveReleaseCheckpointPath
} from "./release-checkpoints.mjs";
import { planReleaseCheckBatch } from "./check/batch-plan.mjs";
import {
  createPackageStates,
  hydrateCachedSteps,
  runTaskScheduler
} from "./check/task-runner.mjs";

const ROOT_DIR = process.cwd();
const DEFAULT_CONCURRENCY = Math.max(4, Math.min(availableParallelism(), 6));
const DEFAULT_STEP_CONCURRENCY = {
  build: Math.max(1, Math.min(3, Math.floor(availableParallelism() / 2) || 1)),
  tsc: Math.max(1, Math.min(4, availableParallelism())),
  lint: 1
};

function readCliFlag(flag) {
  return process.argv.includes(flag);
}

function readBooleanEnvFlag(name) {
  return process.env[name] === "1";
}

function readNumericArg(flag, fallback) {
  const entry = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (!entry) {
    return fallback;
  }
  const [, rawValue] = entry.split("=");
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Invalid ${flag}: ${rawValue}`);
  }
  return parsed;
}

function resolveBatchPackages() {
  const workspacePackages = collectWorkspacePackages();
  const pendingChangesetPackages = readPendingChangesetPackages();
  const explicitBatchPackages = resolveExplicitReleaseBatchPackages(
    workspacePackages,
    pendingChangesetPackages
  );
  if (explicitBatchPackages.length > 0) {
    return explicitBatchPackages;
  }

  if (
    readCliFlag("--from-latest-checkpoint") ||
    readBooleanEnvFlag("NEXTCLAW_RELEASE_CHECK_FROM_LATEST")
  ) {
    return resolveCheckpointReleaseBatchPackages(workspacePackages, readLatestReleaseCheckpoint());
  }

  return explicitBatchPackages;
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
  const checkpointPath = resolveReleaseCheckpointPath(batchId);
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

async function main() {
  const resetCheckpoint = readCliFlag("--reset") || readBooleanEnvFlag("NEXTCLAW_RELEASE_CHECK_RESET");
  const includeLint =
    readCliFlag("--include-lint") || readBooleanEnvFlag("NEXTCLAW_RELEASE_CHECK_INCLUDE_LINT");
  const concurrency = readNumericArg(
    "--concurrency",
    Number(process.env.NEXTCLAW_RELEASE_CHECK_CONCURRENCY) || DEFAULT_CONCURRENCY
  );
  const stepConcurrency = {
    build: readNumericArg(
      "--build-concurrency",
      Number(process.env.NEXTCLAW_RELEASE_CHECK_BUILD_CONCURRENCY) || DEFAULT_STEP_CONCURRENCY.build
    ),
    tsc: readNumericArg(
      "--typecheck-concurrency",
      Number(process.env.NEXTCLAW_RELEASE_CHECK_TYPECHECK_CONCURRENCY) ||
        DEFAULT_STEP_CONCURRENCY.tsc
    ),
    lint: readNumericArg(
      "--lint-concurrency",
      Number(process.env.NEXTCLAW_RELEASE_CHECK_LINT_CONCURRENCY) || DEFAULT_STEP_CONCURRENCY.lint
    )
  };
  const batchPackages = resolveBatchPackages();

  if (batchPackages.length === 0) {
    console.error(
      "No release batch packages found. Create a changeset, run `pnpm release:version`, or use `--from-latest-checkpoint` before `pnpm release:check`."
    );
    process.exit(1);
  }

  const {
    batchId,
    dependencyMap,
    fingerprints,
    orderedBatchPackages,
    priorityScores
  } = planReleaseCheckBatch(batchPackages);
  const { checkpointPath, checkpoint } = readCheckpoint(batchId, orderedBatchPackages, resetCheckpoint);
  const packageStates = createPackageStates({
    checkpoint,
    dependencyMap,
    fingerprints,
    includeLint,
    orderedBatchPackages,
    priorityScores
  });

  console.log(
    `[release:check] batch packages: ${orderedBatchPackages.map((entry) => entry.pkg.name).join(", ")}`
  );
  console.log(`[release:check] checkpoint: ${relative(ROOT_DIR, checkpointPath).replaceAll("\\", "/")}`);
  console.log(`[release:check] concurrency: ${concurrency}`);
  console.log(
    `[release:check] step concurrency: build=${stepConcurrency.build}, tsc=${stepConcurrency.tsc}, lint=${stepConcurrency.lint}`
  );
  console.log(`[release:check] lint included: ${includeLint ? "yes" : "no"}`);
  if (resetCheckpoint) {
    console.log("[release:check] reset checkpoint requested");
  }

  hydrateCachedSteps({
    checkpoint,
    packageStates
  });
  saveCheckpoint(checkpointPath, checkpoint);

  try {
    await runTaskScheduler({
      checkpoint,
      concurrency,
      packageStates,
      saveCheckpoint: () => saveCheckpoint(checkpointPath, checkpoint),
      stepConcurrency
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

await main();
