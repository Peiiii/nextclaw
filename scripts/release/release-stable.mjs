#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { publishPreparedNpmRelease } from "./prepared-npm-release.mjs";
import {
  closeStableGitReleaseState,
  ensureStableCleanWorktree,
  ensureStableCurrentBranch,
  ensureStableRemoteSync,
  ensureStableTargetBranchAvailable,
} from "./release-stable-git.mjs";
import {
  configureReleaseNpmUserconfig,
  ensureProductReleaseArtifacts,
  ensurePublishedStableTarget,
  hasStructuredReleaseNotes,
  inspectReleaseSurfaceReview,
  prepareStableNpmBatch,
  readReleaseCheckpoint,
  resolveStableExecutionContext,
} from "./release-stable-preparation.mjs";
import {
  STABLE_RELEASE_HELP,
  STABLE_RELEASE_STAGES,
  assertNpmReadyWithinBudget,
  buildStableCompletionSummary,
  buildStableDryRunPlan,
  buildStableNpmReadySummary,
  buildStablePublishedInstallArgs,
  buildStablePublishedUpgradeArgs,
  buildStableRuntimeCommandArgs,
  formatStableRecoveryCommand,
  parseStableReleaseArgs,
} from "./release-stable.utils.mjs";

const ROOT_DIR = process.cwd();

function run(command, args, options = {}) {
  const { capture = false } = options;
  return execFileSync(command, args, {
    cwd: ROOT_DIR,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
}

function runAsync(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", rejectPromise);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error(
          `${command} ${args.join(" ")} failed with ${signal ? `signal ${signal}` : `exit ${code}`}`,
        ),
      );
    });
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

function runStableRuntimeClosure(branch, targetVersion, options) {
  const args = buildStableRuntimeCommandArgs(branch, targetVersion, options);
  if (!args) {
    return;
  }
  run("pnpm", args);
}
function runPublishedValidation(args) {
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

async function runReleaseStageAsync(stage, recoveryOptions, callback) {
  try {
    return await callback();
  } catch (error) {
    if (error && typeof error === "object") {
      error.releaseStage = stage;
      error.releaseOptions = recoveryOptions;
    }
    throw error;
  }
}

function printStableDryRun(options, context) {
  const { previousVersion, targetVersion } = context;
  const releaseNotesReady = targetVersion
    ? hasStructuredReleaseNotes(targetVersion)
    : false;
  const surfaceReview = inspectReleaseSurfaceReview(
    previousVersion,
    targetVersion,
  );
  console.log(
    `${options.skipRuntimeChannel ? "release:npm:stable" : "release:product:stable"} dry run`,
  );
  console.log(
    buildStableDryRunPlan({
      ...options,
      ...context,
      releaseNotesReady,
      surfaceReviewReady: surfaceReview.ready,
      surfaceReviewRequired: surfaceReview.required,
      worktreeClean: !readGitStatus(),
    }).join("\n"),
  );
}

function ensurePreparedPublishPrerequisites(options) {
  const { branch, targetBranch } = options;
  ensureCommandAvailable("pnpm");
  ensureCommandAvailable("git");
  ensureCommandAvailable("npm");
  ensureStableCurrentBranch(branch);
  ensureStableRemoteSync(branch);
  ensureStableTargetBranchAvailable(targetBranch);
  if (targetBranch !== branch) {
    run("git", ["fetch", "origin", targetBranch]);
  }
  if (branch !== targetBranch) {
    run("pnpm", [
      "release:check:branch-closure",
      "--",
      "--target",
      `origin/${targetBranch}`,
      "--release",
      "HEAD",
    ]);
  }
  const npmIdentity = run("npm", ["whoami"], { capture: true }).trim();
  console.log(`[release:stable] npm identity: ${npmIdentity}`);
}

async function publishStablePackages(options, context) {
  const { branch, resumeFrom } = options;
  const { previousVersion, startsAt, targetVersion } = context;
  const recoveryOptions = {
    ...options,
    previousVersion,
    version: targetVersion,
  };
  if (startsAt === STABLE_RELEASE_STAGES.indexOf("packages")) {
    ensurePreparedPublishPrerequisites(options);
    const publishSummary = await runReleaseStageAsync(
      "packages",
      recoveryOptions,
      () =>
        publishPreparedNpmRelease({
          onEvent: (event) => {
            if (event.type === "publish-plan") {
              console.log(
                `[release:npm] publish plan: ${event.publishCount} upload(s), ${event.reuseCount} already visible`,
              );
            } else if (event.type === "publish-complete") {
              console.log(
                `[release:npm] uploaded ${event.package.name}@${event.package.version}`,
              );
            } else if (event.type === "registry-verified") {
              console.log(
                `[release:npm] registry verified ${event.packageCount} package(s) in ${event.attemptsUsed} attempt(s)`,
              );
            }
          },
          publishConcurrency: options.publishConcurrency,
          record: context.preparedRecord,
          verifyConcurrency: options.verifyConcurrency,
        }),
    );
    return { checkpoint: context.checkpoint, publishSummary };
  }

  ensureStableCurrentBranch(branch);
  ensurePublishedStableTarget(targetVersion);
  const checkpoint = readReleaseCheckpoint(targetVersion);
  if (resumeFrom === "git") {
    ensureStableRemoteSync(branch, { allowLocalAhead: true });
  } else {
    ensureStableCleanWorktree();
    ensureStableRemoteSync(branch);
  }
  return {
    checkpoint,
    publishSummary: {
      attemptsUsed: 1,
      packageCount: Object.keys(checkpoint?.packages ?? {}).length,
      publishedCount: 0,
      reusedCount: Object.keys(checkpoint?.packages ?? {}).length,
    },
  };
}

function closeStableGitIfNeeded(options, context, checkpoint) {
  const { branch, targetBranch } = options;
  const { previousVersion, startsAt, targetVersion } = context;
  if (startsAt > STABLE_RELEASE_STAGES.indexOf("git")) {
    return { releaseCommit: null, releaseTags: [] };
  }
  const recoveryOptions = {
    ...options,
    previousVersion,
    version: targetVersion,
  };
  return runReleaseStage("git", recoveryOptions, () =>
    closeStableGitReleaseState({ branch, checkpoint, targetBranch }),
  );
}

function runStableRuntimeIfNeeded(options, context) {
  const { branch, skipRuntimeChannel } = options;
  const { previousVersion, startsAt, targetVersion } = context;
  if (!targetVersion || startsAt > STABLE_RELEASE_STAGES.indexOf("runtime")) {
    return;
  }
  const recoveryOptions = {
    ...options,
    previousVersion,
    version: targetVersion,
  };
  runReleaseStage("runtime", recoveryOptions, () => {
    if (!skipRuntimeChannel) {
      ensureProductReleaseArtifacts(previousVersion, targetVersion);
    }
    runStableRuntimeClosure(branch, targetVersion, options);
  });
}

async function runStableNpmInstallIfNeeded(options, context) {
  const { skipPublishedInstall } = options;
  const { previousVersion, targetVersion } = context;
  if (!targetVersion) {
    return;
  }
  if (skipPublishedInstall) {
    return;
  }
  const recoveryOptions = {
    ...options,
    previousVersion,
    version: targetVersion,
  };
  const args = buildStablePublishedInstallArgs(targetVersion, null, options);
  await runReleaseStageAsync("install", recoveryOptions, () =>
    args ? runAsync("pnpm", args) : Promise.resolve(),
  );
}

function runStableInstallIfNeeded(options, context) {
  const { resumeFrom, skipRuntimeChannel } = options;
  const { previousVersion, startsAt, targetVersion } = context;
  if (!targetVersion || startsAt > STABLE_RELEASE_STAGES.indexOf("install")) {
    return;
  }
  if (skipRuntimeChannel) {
    return;
  }
  const recoveryOptions = {
    ...options,
    previousVersion,
    version: targetVersion,
  };
  runReleaseStage("install", recoveryOptions, () => {
    const args =
      resumeFrom === "install"
        ? buildStablePublishedInstallArgs(
            targetVersion,
            previousVersion,
            options,
          )
        : buildStablePublishedUpgradeArgs(
            targetVersion,
            previousVersion,
            options,
          );
    runPublishedValidation(args);
  });
}

function printStableCompletion(options, context, checkpoint, gitSummary) {
  console.log(
    buildStableCompletionSummary({
      ...options,
      ...context,
      ...gitSummary,
      checkpoint,
    }).join("\n"),
  );
}

async function runNpmPostPublishClosure(options, context, checkpoint) {
  const installPromise = runStableNpmInstallIfNeeded(options, context);
  let gitSummary = null;
  let gitError = null;
  try {
    gitSummary = closeStableGitIfNeeded(options, context, checkpoint);
  } catch (error) {
    gitError = error;
  }
  const installResult = await Promise.allSettled([installPromise]);
  const installError =
    installResult[0].status === "rejected" ? installResult[0].reason : null;
  if (gitError || installError) {
    const errors = [gitError, installError].filter(Boolean);
    const aggregateError = new AggregateError(
      errors,
      "NPM post-publish closure failed",
    );
    const primaryError = gitError ?? installError;
    aggregateError.releaseStage =
      primaryError?.releaseStage ?? (gitError ? "git" : "install");
    aggregateError.releaseOptions = primaryError?.releaseOptions;
    throw aggregateError;
  }
  return gitSummary;
}

async function runStableRelease(options) {
  const {
    dryRun,
    maxPublishSeconds,
    prepareOnly,
    skipPublishedInstall,
    skipRuntimeChannel,
    targetBranch,
  } = options;
  const publishStartedAt = dryRun || prepareOnly ? null : performance.now();
  configureReleaseNpmUserconfig({ required: !dryRun && !prepareOnly });
  if (prepareOnly && !dryRun) {
    prepareStableNpmBatch(options);
    return;
  }
  const context = resolveStableExecutionContext(options);
  const contextResolvedAt = dryRun || prepareOnly ? null : performance.now();
  if (dryRun) {
    printStableDryRun(options, context);
    return;
  }
  const { checkpoint, publishSummary } = await publishStablePackages(
    options,
    context,
  );
  const packagesCompletedAt = performance.now();
  const gitSummary = await runNpmPostPublishClosure(
    options,
    context,
    checkpoint,
  );
  const closureCompletedAt = performance.now();
  const publishDurationMs = closureCompletedAt - publishStartedAt;
  assertNpmReadyWithinBudget(publishDurationMs, maxPublishSeconds);
  console.log(
    buildStableNpmReadySummary({
      checkpoint,
      durationMs: publishDurationMs,
      phaseTimings: {
        artifactResolutionMs: contextResolvedAt - publishStartedAt,
        packagePhaseMs: packagesCompletedAt - contextResolvedAt,
        postPublishClosureMs: closureCompletedAt - packagesCompletedAt,
      },
      publishSummary,
      skipPublishedInstall,
      targetBranch,
      targetVersion: context.targetVersion,
    }).join("\n"),
  );
  if (skipRuntimeChannel) {
    return;
  }
  runStableRuntimeIfNeeded(options, context);
  runStableInstallIfNeeded(options, context);
  printStableCompletion(options, context, checkpoint, gitSummary);
}

function collectReleaseErrorDetails(error) {
  const output = [];
  const seen = new Set();
  function visit(currentError) {
    if (!currentError || seen.has(currentError) || output.length >= 8) return;
    seen.add(currentError);
    if (currentError instanceof AggregateError) {
      for (const nestedError of currentError.errors) visit(nestedError);
      return;
    }
    const stderr =
      typeof currentError.stderr === "string" ? currentError.stderr.trim() : "";
    const message =
      stderr ||
      (currentError instanceof Error
        ? currentError.message
        : String(currentError));
    if (message && !output.includes(message)) output.push(message);
  }
  visit(error);
  return output;
}

async function main() {
  const options = parseStableReleaseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(STABLE_RELEASE_HELP);
    return;
  }
  const commandStartedAt = performance.now();
  try {
    await runStableRelease(options);
  } catch (error) {
    const stage = error?.releaseStage ?? "preflight";
    const recoveryOptions = error?.releaseOptions ?? options;
    console.error(
      `[release:stable] ${error instanceof Error ? error.message : String(error)}`,
    );
    for (const detail of collectReleaseErrorDetails(error)) {
      if (detail !== error?.message)
        console.error(`[release:stable] cause: ${detail}`);
    }
    console.error(
      `[release:stable] failed after ${((performance.now() - commandStartedAt) / 1000).toFixed(2)}s at stage ${stage}`,
    );
    if (stage === "packages") {
      console.error(
        "Recovery: do not rerun publish blindly. Inspect the release checkpoint and run pnpm release:verify:published before choosing --resume-from git.",
      );
    } else if (stage !== "preflight" && recoveryOptions.version) {
      console.error(
        `Recovery: ${formatStableRecoveryCommand(stage, recoveryOptions)}`,
      );
    }
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await main();
}
