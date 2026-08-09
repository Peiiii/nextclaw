#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readLatestReleaseCheckpoint } from "./release-checkpoints.mjs";
import {
  STABLE_RELEASE_HELP,
  STABLE_RELEASE_STAGES,
  buildStableCompletionSummary,
  buildStableDryRunPlan,
  buildStablePublishedInstallArgs,
  buildStableReleaseTags,
  buildStableRuntimeCommandArgs,
  formatStableRecoveryCommand,
  parseStableReleaseArgs,
  resolveStableReleasePlan,
  validateStableResumeOptions
} from "./release-stable.utils.mjs";

const ROOT_DIR = process.cwd();

function run(command, args, options = {}) {
  const { capture = false } = options;
  return execFileSync(command, args, {
    cwd: ROOT_DIR,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });
}

function git(args, capture = true) {
  return run("git", args, { capture }).trim();
}

function ensureCommandAvailable(command, args = ["--version"]) {
  try {
    run(command, args, { capture: true });
  } catch {
    throw new Error(`Required command is unavailable: ${command}`);
  }
}

function readGitStatus() {
  return git(["status", "--short"]);
}
function readCurrentBranch() {
  return git(["rev-parse", "--abbrev-ref", "HEAD"]);
}

function ensureCurrentBranch(branch) {
  const currentBranch = readCurrentBranch();
  if (currentBranch !== branch) {
    throw new Error(`release:stable requires branch ${branch}; current branch is ${currentBranch}.`);
  }
}

function ensureCleanWorktree() {
  if (readGitStatus()) {
    throw new Error("release:stable requires a clean worktree before package publishing.");
  }
}

function ensureRemoteSync(branch, { allowLocalAhead = false } = {}) {
  run("git", ["fetch", "origin", branch]);
  const counts = git(["rev-list", "--left-right", "--count", `origin/${branch}...HEAD`])
    .split(/\s+/)
    .map(Number);
  const [remoteOnly, localOnly] = counts;
  if (remoteOnly !== 0 || (!allowLocalAhead && localOnly !== 0)) {
    throw new Error(
      `release:stable branch is not synchronized with origin/${branch}: remote-only=${remoteOnly}, local-only=${localOnly}.`
    );
  }
}

function readChangesetStatus() {
  const tempDirectory = join(ROOT_DIR, "tmp");
  mkdirSync(tempDirectory, { recursive: true });
  const outputPath = join(tempDirectory, `release-stable-plan-${process.pid}.json`);
  try {
    run("pnpm", [
      "exec",
      "changeset",
      "status",
      "--output",
      relative(ROOT_DIR, outputPath)
    ], { capture: true });
    return JSON.parse(readFileSync(outputPath, "utf8"));
  } finally {
    rmSync(outputPath, { force: true });
  }
}

function readPublishedStableVersion() {
  return run("npm", ["view", "nextclaw@latest", "version"], { capture: true }).trim();
}

function ensurePublishedStableTarget(targetVersion) {
  if (!targetVersion) {
    return;
  }
  ensureCommandAvailable("npm");
  const exactVersion = run("npm", ["view", `nextclaw@${targetVersion}`, "version"], {
    capture: true
  }).trim();
  const latestVersion = readPublishedStableVersion();
  if (exactVersion !== targetVersion || latestVersion !== targetVersion) {
    throw new Error(
      `Published stable identity mismatch: exact=${exactVersion || "<missing>"}, latest=${latestVersion || "<missing>"}, expected=${targetVersion}.`
    );
  }
}

function resolveReleaseNotesPath(version) {
  return resolve(ROOT_DIR, `apps/docs/public/release-notes/nextclaw-v${version}.json`);
}

function hasStructuredReleaseNotes(version) {
  if (!version) {
    return false;
  }
  const releaseNotesPath = resolveReleaseNotesPath(version);
  if (!existsSync(releaseNotesPath)) {
    return false;
  }
  try {
    const metadata = JSON.parse(readFileSync(releaseNotesPath, "utf8"));
    return Boolean(metadata?.links?.html?.["en-US"] || metadata?.links?.html?.["zh-CN"]);
  } catch {
    return false;
  }
}

function ensurePrePublishArtifacts(targetVersion, skipRuntimeChannel) {
  if (!targetVersion) {
    return;
  }
  const publicKeyPath = resolve(ROOT_DIR, "packages/nextclaw/resources/update-bundle-public.pem");
  if (!existsSync(publicKeyPath)) {
    throw new Error(`nextclaw package public key is missing: ${publicKeyPath}`);
  }
  if (!skipRuntimeChannel && !hasStructuredReleaseNotes(targetVersion)) {
    throw new Error(
      `Stable runtime release notes are missing or invalid: ${resolveReleaseNotesPath(targetVersion)}`
    );
  }
}

function ensurePackageReleasePrerequisites(branch) {
  ensureCommandAvailable("pnpm");
  ensureCommandAvailable("git");
  ensureCommandAvailable("npm");
  ensureCurrentBranch(branch);
  ensureCleanWorktree();
  ensureRemoteSync(branch);
  run("npm", ["whoami"], { capture: true });
}

function runPackageRelease(expectedTargetVersion) {
  run("pnpm", ["release:auto:prepare"]);
  const preparedPlan = resolveStableReleasePlan(readChangesetStatus());
  if (preparedPlan.targetVersion !== expectedTargetVersion) {
    throw new Error(
      `release:auto:prepare changed the planned nextclaw version from ${expectedTargetVersion ?? "<none>"} to ${preparedPlan.targetVersion ?? "<none>"}. Review the expanded batch before publishing.`
    );
  }
  run("pnpm", ["release:version"]);
  run("pnpm", ["release:check:strict"]);
  run("pnpm", ["release:publish"]);
}

function readReleaseCheckpoint(targetVersion) {
  const checkpointRecord = readLatestReleaseCheckpoint();
  if (!checkpointRecord) {
    throw new Error("release:stable could not find the package release checkpoint.");
  }
  const checkpoint = checkpointRecord.checkpoint;
  const checkpointVersion = checkpoint?.packages?.nextclaw?.version ?? null;
  if (targetVersion && checkpointVersion !== targetVersion) {
    throw new Error(
      `Latest release checkpoint nextclaw version ${checkpointVersion ?? "<missing>"} does not match ${targetVersion}.`
    );
  }
  return checkpoint;
}

function commitReleaseArtifactsIfNeeded() {
  if (!readGitStatus()) {
    return git(["rev-parse", "HEAD"]);
  }
  run("git", ["add", "-A"]);
  run("git", ["commit", "-m", "chore: release stable batch"]);
  return git(["rev-parse", "HEAD"]);
}

function closeGitReleaseState(branch, checkpoint) {
  ensureCommandAvailable("git");
  ensureCurrentBranch(branch);
  const releaseCommit = commitReleaseArtifactsIfNeeded();
  const releaseTags = buildStableReleaseTags(checkpoint);
  for (const tag of releaseTags) {
    run("git", ["tag", "-f", tag, releaseCommit]);
  }
  run("git", ["push", "origin", `HEAD:${branch}`]);
  if (releaseTags.length > 0) {
    run("git", ["push", "origin", ...releaseTags.map((tag) => `refs/tags/${tag}`)]);
  }
  return { releaseCommit, releaseTags };
}

function runStableRuntimeClosure(branch, targetVersion, options) {
  const args = buildStableRuntimeCommandArgs(branch, targetVersion, options);
  if (!args) {
    return;
  }
  run("pnpm", args);
}
function runPublishedInstallValidation(targetVersion, previousVersion, options) {
  const args = buildStablePublishedInstallArgs(targetVersion, previousVersion, options);
  if (!args) {
    return;
  }
  run("pnpm", args);
}
function runReleaseStage(stage, recoveryOptions, callback) {
  try {
    return callback();
  } catch (error) {
    if (error && typeof error === "object") {
      error.releaseStage = stage;
      error.releaseOptions = recoveryOptions;
    }
    throw error;
  }
}

function resolveStableExecutionContext(options) {
  const {
    dryRun,
    previousVersion: requestedPreviousVersion,
    resumeFrom,
    version: requestedVersion
  } = options;
  validateStableResumeOptions(options);
  const startsAt = STABLE_RELEASE_STAGES.indexOf(resumeFrom);
  let packageCount = 0;
  let previousVersion = requestedPreviousVersion;
  let targetVersion = requestedVersion;
  let checkpoint = null;

  if (resumeFrom === "packages") {
    const plan = resolveStableReleasePlan(readChangesetStatus());
    packageCount = plan.packageCount;
    previousVersion = plan.previousVersion;
    targetVersion = plan.targetVersion;
    if (packageCount === 0) {
      throw new Error("release:stable found no pending release packages.");
    }
    if (targetVersion) {
      const publishedStableVersion = readPublishedStableVersion();
      if (previousVersion !== publishedStableVersion) {
        throw new Error(
          `Changesets expects nextclaw ${previousVersion}, but npm latest is ${publishedStableVersion}.`
        );
      }
    }
  } else if (dryRun) {
    checkpoint = readReleaseCheckpoint(targetVersion);
    packageCount = Object.keys(checkpoint?.packages ?? {}).length;
  }

  return { checkpoint, packageCount, previousVersion, startsAt, targetVersion };
}

function printStableDryRun(options, context) {
  const { targetVersion } = context;
  const releaseNotesReady = targetVersion ? hasStructuredReleaseNotes(targetVersion) : false;
  console.log("release:stable dry run");
  console.log(
    buildStableDryRunPlan({
      ...options,
      ...context,
      releaseNotesReady,
      worktreeClean: !readGitStatus()
    }).join("\n")
  );
}

function prepareStableCheckpoint(options, context) {
  const { branch, resumeFrom, skipRuntimeChannel } = options;
  const { previousVersion, startsAt, targetVersion } = context;
  const recoveryOptions = { ...options, previousVersion, version: targetVersion };
  if (startsAt === STABLE_RELEASE_STAGES.indexOf("packages")) {
    ensurePackageReleasePrerequisites(branch);
    ensurePrePublishArtifacts(targetVersion, skipRuntimeChannel);
    runReleaseStage("packages", recoveryOptions, () => runPackageRelease(targetVersion));
    runReleaseStage("git", recoveryOptions, () => ensurePublishedStableTarget(targetVersion));
    return runReleaseStage("git", recoveryOptions, () => readReleaseCheckpoint(targetVersion));
  }

  ensureCurrentBranch(branch);
  ensurePublishedStableTarget(targetVersion);
  const checkpoint = readReleaseCheckpoint(targetVersion);
  if (resumeFrom === "git") {
    ensureRemoteSync(branch, { allowLocalAhead: true });
  } else {
    ensureCleanWorktree();
    ensureRemoteSync(branch);
  }
  return checkpoint;
}

function closeStableGitIfNeeded(options, context, checkpoint) {
  const { branch } = options;
  const { previousVersion, startsAt, targetVersion } = context;
  if (startsAt > STABLE_RELEASE_STAGES.indexOf("git")) {
    return { releaseCommit: null, releaseTags: [] };
  }
  const recoveryOptions = { ...options, previousVersion, version: targetVersion };
  return runReleaseStage("git", recoveryOptions, () =>
    closeGitReleaseState(branch, checkpoint)
  );
}

function runStableRuntimeIfNeeded(options, context) {
  const { branch, skipRuntimeChannel } = options;
  const { previousVersion, startsAt, targetVersion } = context;
  if (!targetVersion || startsAt > STABLE_RELEASE_STAGES.indexOf("runtime")) {
    return;
  }
  const recoveryOptions = { ...options, previousVersion, version: targetVersion };
  runReleaseStage("runtime", recoveryOptions, () => {
    ensurePrePublishArtifacts(targetVersion, skipRuntimeChannel);
    runStableRuntimeClosure(branch, targetVersion, options);
  });
}

function runStableInstallIfNeeded(options, context) {
  const { previousVersion, startsAt, targetVersion } = context;
  if (!targetVersion || startsAt > STABLE_RELEASE_STAGES.indexOf("install")) {
    return;
  }
  const recoveryOptions = { ...options, previousVersion, version: targetVersion };
  runReleaseStage("install", recoveryOptions, () =>
    runPublishedInstallValidation(targetVersion, previousVersion, options)
  );
}

function printStableCompletion(options, context, checkpoint, gitSummary) {
  console.log(
    buildStableCompletionSummary({ ...options, ...context, ...gitSummary, checkpoint }).join("\n")
  );
}

function runStableRelease(options) {
  const { dryRun } = options;
  const context = resolveStableExecutionContext(options);
  if (dryRun) {
    printStableDryRun(options, context);
    return;
  }

  const checkpoint = prepareStableCheckpoint(options, context);
  const gitSummary = closeStableGitIfNeeded(options, context, checkpoint);
  runStableRuntimeIfNeeded(options, context);
  runStableInstallIfNeeded(options, context);
  printStableCompletion(options, context, checkpoint, gitSummary);
}

function main() {
  const options = parseStableReleaseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(STABLE_RELEASE_HELP);
    return;
  }
  try {
    runStableRelease(options);
  } catch (error) {
    const stage = error?.releaseStage ?? "preflight";
    const recoveryOptions = error?.releaseOptions ?? options;
    console.error(`[release:stable] ${error instanceof Error ? error.message : String(error)}`);
    if (stage === "packages") {
      console.error(
        "Recovery: do not rerun publish blindly. Inspect the release checkpoint and run pnpm release:verify:published before choosing --resume-from git."
      );
    } else if (stage !== "preflight" && recoveryOptions.version) {
      console.error(`Recovery: ${formatStableRecoveryCommand(stage, recoveryOptions)}`);
    }
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  main();
}
