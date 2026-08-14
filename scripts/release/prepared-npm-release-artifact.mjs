import { execFileSync, spawnSync } from "node:child_process";
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
  readPreparedNpmRelease,
  resolvePreparedNpmReleaseRoot,
  validatePreparedNpmRelease,
  writePreparedNpmReleasePointer,
} from "./prepared-npm-release.mjs";

const ROOT_DIR = process.cwd();
const ARTIFACT_SCHEMA_VERSION = 1;
export const PREPARED_NPM_WORKFLOW = "npm-release-prepare.yml";
export const PREPARED_NPM_ARTIFACT_PREFIX = "npm-release-prepared";

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
  if (!resolvedChild.startsWith(`${resolvedParent}/`)) {
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

export function selectPreparedNpmWorkflowRun(runs, sourceCommit) {
  return (
    runs.find(
      (entry) =>
        entry?.headSha === sourceCommit &&
        entry?.status === "completed" &&
        entry?.conclusion === "success",
    ) ?? null
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
  const runs = JSON.parse(
    runCommand(
      "gh",
      [
        "run",
        "list",
        "--workflow",
        workflow,
        "--commit",
        sourceCommit,
        "--limit",
        "10",
        "--json",
        "databaseId,headSha,status,conclusion",
      ],
      { cwd: rootDir },
    ) || "[]",
  );
  const workflowRun = selectPreparedNpmWorkflowRun(runs, sourceCommit);
  if (!workflowRun) {
    throw new Error(
      `No successful ${workflow} artifact exists for ${sourceCommit}. Wait for release preparation; the publish command will not rebuild inside the 60-second window.`,
    );
  }
  const downloadRoot = mkdtempSync(join(tmpdir(), "nextclaw-npm-artifact-"));
  try {
    const artifactName = `${PREPARED_NPM_ARTIFACT_PREFIX}-${sourceCommit}`;
    runCommand(
      "gh",
      [
        "run",
        "download",
        String(workflowRun.databaseId),
        "--name",
        artifactName,
        "--dir",
        downloadRoot,
      ],
      { cwd: rootDir },
    );
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
