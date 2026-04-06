import { setTimeout as sleep } from "node:timers/promises";
import {
  collectWorkspacePackages,
  readNpmRegistry,
  readPendingChangesetPackages,
  resolveExplicitReleaseBatchPackages,
  isPackageVersionPublished
} from "./release-scope.mjs";
import {
  readLatestReleaseCheckpoint,
  resolveCheckpointReleaseBatchPackages
} from "./release-checkpoints.mjs";

const DEFAULT_ATTEMPTS = 12;
const DEFAULT_DELAY_MS = 5000;

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

function formatSpec(entry) {
  return `${entry.pkg.name}@${entry.pkg.version}`;
}

const attempts = readNumericArg("--attempts", DEFAULT_ATTEMPTS);
const delayMs = readNumericArg("--delay-ms", DEFAULT_DELAY_MS);
const workspacePackages = collectWorkspacePackages();
const pendingChangesetPackages = readPendingChangesetPackages();
const explicitBatchPackages = resolveExplicitReleaseBatchPackages(
  workspacePackages,
  pendingChangesetPackages
);
const checkpointRecord =
  explicitBatchPackages.length === 0 ? readLatestReleaseCheckpoint() : null;
const batchPackages =
  explicitBatchPackages.length > 0
    ? explicitBatchPackages
    : resolveCheckpointReleaseBatchPackages(workspacePackages, checkpointRecord);

if (batchPackages.length === 0) {
  console.error(
    "No release batch packages found from explicit release state or release checkpoints."
  );
  process.exit(1);
}

console.log(`[release:verify:published] registry: ${readNpmRegistry()}`);
if (checkpointRecord) {
  console.log(
    `[release:verify:published] batch source: checkpoint ${checkpointRecord.checkpoint.batchId}`
  );
}
console.log(
  `[release:verify:published] batch packages: ${batchPackages
    .map((entry) => entry.pkg.name)
    .join(", ")}`
);

let missingPackages = batchPackages;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  missingPackages = missingPackages.filter((entry) => !isPackageVersionPublished(entry));
  if (missingPackages.length === 0) {
    console.log(
      `[release:verify:published] published ${batchPackages.length}/${batchPackages.length} package versions.`
    );
    process.exit(0);
  }

  console.warn(
    `[release:verify:published] attempt ${attempt}/${attempts}: still waiting for ${missingPackages.length} package versions`
  );
  for (const entry of missingPackages) {
    console.warn(`- ${formatSpec(entry)}`);
  }

  if (attempt < attempts) {
    await sleep(delayMs);
  }
}

console.error("[release:verify:published] registry verification failed.");
for (const entry of missingPackages) {
  console.error(`- missing on registry: ${formatSpec(entry)}`);
}
process.exit(1);
