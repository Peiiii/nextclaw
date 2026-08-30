import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  isPathWithinDirectory,
  readPreparedNpmRelease,
  resolvePreparedNpmReleaseRoot,
  validatePreparedNpmRelease,
  writePreparedNpmReleasePointer,
} from "./prepared-npm-release.mjs";

const ROOT_DIR = process.cwd();
const ARTIFACT_SCHEMA_VERSION = 1;
export const PREPARED_NPM_WORKFLOW = "npm-release-prepare.yml";
export const PREPARED_NPM_ARTIFACT_PREFIX = "npm-release-prepared";
const PREPARED_NPM_ARTIFACT_JOB = "prepare exact-commit NPM artifact";
const DEFAULT_ARTIFACT_JOB_ATTEMPTS = 240;
const DEFAULT_ARTIFACT_DOWNLOAD_ATTEMPTS = 12;
const ARTIFACT_RETRY_DELAY_MS = 5000;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 100 * 1024 * 1024,
  }).trim();
}

function git(args, rootDir = ROOT_DIR) {
  return run("git", args, { cwd: rootDir });
}

function listUntrackedFiles(rootDir) {
  return git(["ls-files", "--others", "--exclude-standard", "-z"], rootDir)
    .split("\0")
    .filter(Boolean)
    .sort();
}

function createReleasePatch(rootDir) {
  const chunks = [
    execFileSync(
      "git",
      ["diff", "--binary", "--no-ext-diff", "HEAD", "--", "."],
      {
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 100 * 1024 * 1024,
      },
    ),
  ];
  for (const filePath of listUntrackedFiles(rootDir)) {
    const result = spawnSync(
      "git",
      [
        "diff",
        "--binary",
        "--no-ext-diff",
        "--no-index",
        "--",
        "/dev/null",
        filePath,
      ],
      {
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 100 * 1024 * 1024,
      },
    );
    if (result.status !== 1 || result.error) {
      throw (
        result.error ??
        new Error(`Could not encode untracked release file: ${filePath}`)
      );
    }
    chunks.push(result.stdout);
  }
  const patch = chunks.filter(Boolean).join("\n");
  if (!patch.trim()) {
    throw new Error("Prepared NPM artifact has no release-tree patch.");
  }
  return patch;
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readArtifactDescriptor(artifactDirectory) {
  const descriptorPath = join(artifactDirectory, "artifact.json");
  if (!existsSync(descriptorPath)) {
    throw new Error(
      `Prepared NPM artifact descriptor is missing: ${descriptorPath}`,
    );
  }
  const descriptor = JSON.parse(readFileSync(descriptorPath, "utf8"));
  if (
    descriptor.schemaVersion !== ARTIFACT_SCHEMA_VERSION ||
    typeof descriptor.sourceCommit !== "string" ||
    typeof descriptor.treeFingerprint !== "string" ||
    typeof descriptor.targetBranch !== "string" ||
    typeof descriptor.targetVersion !== "string" ||
    typeof descriptor.manifestPath !== "string" ||
    typeof descriptor.patchPath !== "string"
  ) {
    throw new Error(
      `Prepared NPM artifact descriptor is invalid: ${descriptorPath}`,
    );
  }
  return descriptor;
}

function resolveContainedPath(parentDirectory, childPath, label) {
  const resolvedParent = resolve(parentDirectory);
  const resolvedChild = resolve(resolvedParent, childPath);
  if (!isPathWithinDirectory(resolvedParent, resolvedChild)) {
    throw new Error(`${label} escapes the prepared artifact: ${childPath}`);
  }
  return resolvedChild;
}

export function exportPreparedNpmReleaseArtifact(options) {
  const { outputDirectory, record, rootDir = ROOT_DIR } = options;
  validatePreparedNpmRelease({ record, rootDir });
  const resolvedOutput = resolve(outputDirectory);
  if (existsSync(resolvedOutput)) {
    throw new Error(
      `Prepared NPM artifact output already exists: ${resolvedOutput}`,
    );
  }
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  const temporaryDirectory = mkdtempSync(
    join(dirname(resolvedOutput), ".npm-artifact-"),
  );
  try {
    const batchDirectory = join(temporaryDirectory, "batch");
    cpSync(record.batchDirectory, batchDirectory, {
      recursive: true,
      errorOnExist: true,
    });
    writeFileSync(
      join(temporaryDirectory, "release.patch"),
      createReleasePatch(rootDir),
    );
    writeJson(join(temporaryDirectory, "artifact.json"), {
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      sourceCommit: record.manifest.sourceCommit,
      treeFingerprint: record.manifest.treeFingerprint,
      targetBranch: record.manifest.targetBranch,
      targetVersion: record.manifest.targetVersion,
      manifestPath: "batch/manifest.json",
      patchPath: "release.patch",
    });
    renameSync(temporaryDirectory, resolvedOutput);
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
  return resolvedOutput;
}

function ensureCleanImportBase(rootDir) {
  const status = git(["status", "--short", "--untracked-files=all"], rootDir);
  if (status) {
    throw new Error(
      "Prepared NPM artifact import requires a clean source worktree.",
    );
  }
}

function applyPatch(patchPath, rootDir, reverse = false) {
  const args = ["apply", "--binary"];
  if (reverse) args.push("--reverse");
  args.push(patchPath);
  git(args, rootDir);
}

function resolveImportPayload(options) {
  const { artifactDirectory, rootDir, targetBranch } = options;
  const descriptor = readArtifactDescriptor(artifactDirectory);
  const sourceCommit = git(["rev-parse", "HEAD"], rootDir);
  if (descriptor.sourceCommit !== sourceCommit) {
    throw new Error(
      `Prepared NPM artifact source ${descriptor.sourceCommit} does not match HEAD ${sourceCommit}.`,
    );
  }
  if (targetBranch && descriptor.targetBranch !== targetBranch) {
    throw new Error(
      `Prepared NPM artifact target branch ${descriptor.targetBranch} does not match ${targetBranch}.`,
    );
  }
  const sourceManifestPath = resolveContainedPath(
    artifactDirectory,
    descriptor.manifestPath,
    "manifest path",
  );
  const patchPath = resolveContainedPath(
    artifactDirectory,
    descriptor.patchPath,
    "patch path",
  );
  if (!existsSync(sourceManifestPath) || !existsSync(patchPath)) {
    throw new Error("Prepared NPM artifact payload is incomplete.");
  }
  const manifest = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
  if (
    manifest.sourceCommit !== sourceCommit ||
    manifest.treeFingerprint !== descriptor.treeFingerprint ||
    manifest.targetVersion !== descriptor.targetVersion
  ) {
    throw new Error(
      "Prepared NPM artifact identity does not match its manifest.",
    );
  }
  if (!/^[A-Za-z0-9._-]+$/.test(manifest.batchId ?? "")) {
    throw new Error(
      `Prepared NPM batch identity is invalid: ${manifest.batchId ?? "<missing>"}`,
    );
  }
  return { descriptor, manifest, patchPath, sourceManifestPath };
}

export function importPreparedNpmReleaseArtifact(options) {
  const {
    artifactDirectory,
    registry,
    rootDir = ROOT_DIR,
    targetBranch,
  } = options;
  ensureCleanImportBase(rootDir);
  const { descriptor, manifest, patchPath, sourceManifestPath } =
    resolveImportPayload({
      artifactDirectory,
      rootDir,
      targetBranch,
    });

  run("git", ["apply", "--check", "--binary", patchPath], { cwd: rootDir });
  let patchApplied = false;
  let installedBatch = false;
  const preparedRoot = resolvePreparedNpmReleaseRoot(rootDir);
  const batchDirectory = join(
    preparedRoot,
    `${manifest.targetVersion}-${manifest.batchId}`,
  );
  try {
    applyPatch(patchPath, rootDir);
    patchApplied = true;
    if (!existsSync(batchDirectory)) {
      mkdirSync(preparedRoot, { recursive: true });
      cpSync(dirname(sourceManifestPath), batchDirectory, {
        recursive: true,
        errorOnExist: true,
      });
      installedBatch = true;
    }
    const record = {
      batchDirectory,
      manifest,
      manifestPath: join(batchDirectory, "manifest.json"),
    };
    validatePreparedNpmRelease({
      record,
      registry,
      rootDir,
      targetBranch,
      targetVersion: descriptor.targetVersion,
    });
    writePreparedNpmReleasePointer(record.manifestPath, rootDir);
    return record;
  } catch (error) {
    if (installedBatch) {
      rmSync(batchDirectory, { force: true, recursive: true });
    }
    if (patchApplied) {
      try {
        applyPatch(patchPath, rootDir, true);
      } catch {
        // Preserve the original import failure; the dirty worktree remains observable.
      }
    }
    throw error;
  }
}

function isPreparedRunForSource(entry, sourceCommit) {
  return (
    entry?.headSha === sourceCommit ||
    String(entry?.displayTitle ?? "").includes(`source=${sourceCommit}`)
  );
}

export function selectPreparedNpmWorkflowRun(runs, sourceCommit) {
  return (
    runs.find(
      (entry) =>
        isPreparedRunForSource(entry, sourceCommit) &&
        entry?.status === "completed" &&
        entry?.conclusion === "success",
    ) ?? null
  );
}

export function selectActivePreparedNpmWorkflowRun(runs, sourceCommit) {
  return (
    runs.find(
      (entry) =>
        isPreparedRunForSource(entry, sourceCommit) &&
        ["queued", "in_progress", "waiting", "requested", "pending"].includes(entry?.status),
    ) ?? null
  );
}

function blockingSleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function listPreparedWorkflowRuns({ rootDir, runCommand, workflow }) {
  return JSON.parse(
    runCommand(
      "gh",
      [
        "run",
        "list",
        "--workflow",
        workflow,
        "--limit",
        "50",
        "--json",
        "databaseId,createdAt,displayTitle,event,headSha,status,conclusion",
      ],
      { cwd: rootDir },
    ) || "[]",
  );
}

function waitForDispatchedPreparedRun(options) {
  const { dispatchId, locateAttempts, rootDir, runCommand, sleep, workflow } = options;
  for (let attempt = 1; attempt <= locateAttempts; attempt += 1) {
    const runEntry = listPreparedWorkflowRuns({ rootDir, runCommand, workflow }).find((entry) =>
      String(entry?.displayTitle ?? "").includes(`dispatch=${dispatchId}`),
    );
    if (runEntry) return runEntry;
    if (attempt < locateAttempts) sleep(5000);
  }
  throw new Error(`Timed out locating ${workflow} recovery dispatch ${dispatchId}.`);
}

function readPreparedWorkflowJobs({ rootDir, runCommand, runEntry }) {
  const result = runCommand(
    "gh",
    ["run", "view", String(runEntry.databaseId), "--json", "jobs"],
    { cwd: rootDir },
  );
  return JSON.parse(result || "{}").jobs ?? [];
}

function waitForPreparedNpmArtifactJob(options) {
  const {
    artifactJobAttempts,
    rootDir,
    runCommand,
    runEntry,
    sleep,
  } = options;
  for (let attempt = 1; attempt <= artifactJobAttempts; attempt += 1) {
    const job = readPreparedWorkflowJobs({ rootDir, runCommand, runEntry }).find(
      (entry) => entry?.name === PREPARED_NPM_ARTIFACT_JOB,
    );
    if (job?.status === "completed" && job?.conclusion === "success") {
      return runEntry;
    }
    if (job?.status === "completed") {
      throw new Error(
        `Exact-commit NPM artifact job failed in ${runEntry.databaseId}: ${job.conclusion ?? "unknown conclusion"}.`,
      );
    }
    if (attempt < artifactJobAttempts) sleep(ARTIFACT_RETRY_DELAY_MS);
  }
  throw new Error(
    `Timed out waiting for exact-commit NPM artifact job in ${runEntry.databaseId}.`,
  );
}

function downloadPreparedNpmArtifact(options) {
  const {
    artifactName,
    downloadAttempts,
    downloadRoot,
    rootDir,
    runCommand,
    runEntry,
    sleep,
  } = options;
  let lastError = null;
  for (let attempt = 1; attempt <= downloadAttempts; attempt += 1) {
    rmSync(downloadRoot, { force: true, recursive: true });
    mkdirSync(downloadRoot, { recursive: true });
    try {
      runCommand(
        "gh",
        [
          "run",
          "download",
          String(runEntry.databaseId),
          "--name",
          artifactName,
          "--dir",
          downloadRoot,
        ],
        { cwd: rootDir },
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < downloadAttempts) sleep(ARTIFACT_RETRY_DELAY_MS);
    }
  }
  throw new Error(
    `Exact-commit NPM artifact ${artifactName} was not downloadable from ${runEntry.databaseId} after ${downloadAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function tryReadValidLocalRecord(options) {
  const { registry, rootDir, sourceCommit, targetBranch } = options;
  try {
    const record = readPreparedNpmRelease(rootDir);
    if (record.manifest.sourceCommit !== sourceCommit) {
      return null;
    }
    return validatePreparedNpmRelease({
      record,
      registry,
      rootDir,
      targetBranch,
    });
  } catch {
    return null;
  }
}

export function ensurePreparedNpmReleaseArtifact(options = {}) {
  const {
    registry,
    rootDir = ROOT_DIR,
    runCommand = run,
    sleep = blockingSleep,
    artifactJobAttempts = DEFAULT_ARTIFACT_JOB_ATTEMPTS,
    downloadAttempts = DEFAULT_ARTIFACT_DOWNLOAD_ATTEMPTS,
    locateAttempts = 30,
    targetBranch = "master",
    workflow = PREPARED_NPM_WORKFLOW,
  } = options;
  const sourceCommit = git(["rev-parse", "HEAD"], rootDir);
  const localRecord = tryReadValidLocalRecord({
    registry,
    rootDir,
    sourceCommit,
    targetBranch,
  });
  if (localRecord) return localRecord;

  ensureCleanImportBase(rootDir);
  let runs = listPreparedWorkflowRuns({ rootDir, runCommand, workflow });
  let workflowRun = selectPreparedNpmWorkflowRun(runs, sourceCommit);
  if (!workflowRun) {
    const candidateRun = runs.find((entry) =>
      isPreparedRunForSource(entry, sourceCommit),
    );
    if (candidateRun) {
      try {
        workflowRun = waitForPreparedNpmArtifactJob({
          artifactJobAttempts,
          rootDir,
          runCommand,
          runEntry: candidateRun,
          sleep,
        });
      } catch {
        // The exact-SHA recovery below is the single explicit fallback for a failed/cancelled NPM preparation job.
      }
    }
  }
  if (!workflowRun) {
    const dispatchId = `npm-prepare-${randomUUID()}`;
    runCommand(
      "gh",
      [
        "workflow",
        "run",
        workflow,
        "-f",
        `source_sha=${sourceCommit}`,
        "-f",
        `dispatch_id=${dispatchId}`,
      ],
      { cwd: rootDir },
    );
    const recoveryRun = waitForDispatchedPreparedRun({
      dispatchId,
      locateAttempts,
      rootDir,
      runCommand,
      sleep,
      workflow,
    });
    workflowRun = waitForPreparedNpmArtifactJob({
      artifactJobAttempts,
      rootDir,
      runCommand,
      runEntry: recoveryRun,
      sleep,
    });
  }
  if (!workflowRun) {
    throw new Error(`Exact-commit preparation completed without a successful ${workflow} run for ${sourceCommit}.`);
  }
  const downloadRoot = mkdtempSync(join(tmpdir(), "nextclaw-npm-artifact-"));
  try {
    const artifactName = `${PREPARED_NPM_ARTIFACT_PREFIX}-${sourceCommit}`;
    downloadPreparedNpmArtifact({
      artifactName,
      downloadAttempts,
      downloadRoot,
      rootDir,
      runCommand,
      runEntry: workflowRun,
      sleep,
    });
    return importPreparedNpmReleaseArtifact({
      artifactDirectory: downloadRoot,
      registry,
      rootDir,
      targetBranch,
    });
  } finally {
    rmSync(downloadRoot, { force: true, recursive: true });
  }
}

export function preparedNpmArtifactName(sourceCommit) {
  return `${PREPARED_NPM_ARTIFACT_PREFIX}-${sourceCommit}`;
}
