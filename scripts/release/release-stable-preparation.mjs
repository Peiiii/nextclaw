import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { readLatestReleaseCheckpoint } from "./release-checkpoints.mjs";
import { summarizePlannedReleaseScope } from "./release-scope.mjs";
import { createPreparedNpmRelease } from "./prepared-npm-release.mjs";
import {
  ensurePreparedNpmReleaseArtifact,
  exportPreparedNpmReleaseArtifact,
} from "./prepared-npm-release-artifact.mjs";
import {
  ensureStableCleanWorktree,
  ensureStableCurrentBranch,
  ensureStableRemoteSync,
  resolveReleaseNpmUserconfig,
} from "./release-stable-git.mjs";
import {
  STABLE_RELEASE_STAGES,
  inspectStableSurfaceReview,
  resolveStablePublishedPreviousVersion,
  resolveStableReleasePlan,
  validateStableResumeOptions,
} from "./release-stable.utils.mjs";
import { collectReleaseSummary } from "./release-summary.mjs";
import { assertTrustedPublishingEnvironment } from "./release-action-environment.mjs";

const ROOT_DIR = process.cwd();

function run(command, args, options = {}) {
  const { capture = false } = options;
  return execFileSync(command, args, {
    cwd: ROOT_DIR,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
}

function git(args) {
  return run("git", args, { capture: true }).trim();
}

function ensureCommandAvailable(command, args = ["--version"]) {
  try {
    run(command, args, { capture: true });
  } catch {
    throw new Error(`Required command is unavailable: ${command}`);
  }
}

export function readNpmRegistry() {
  return run("npm", ["config", "get", "registry"], { capture: true }).trim();
}

function readChangesetStatus() {
  const tempDirectory = join(ROOT_DIR, "tmp");
  mkdirSync(tempDirectory, { recursive: true });
  const outputPath = join(
    tempDirectory,
    `release-stable-plan-${process.pid}.json`,
  );
  try {
    run(
      "pnpm",
      [
        "exec",
        "changeset",
        "status",
        "--output",
        relative(ROOT_DIR, outputPath),
      ],
      { capture: true },
    );
    return JSON.parse(readFileSync(outputPath, "utf8"));
  } finally {
    rmSync(outputPath, { force: true });
  }
}

function readPublishedStableVersion() {
  return run("npm", ["view", "nextclaw@latest", "version"], {
    capture: true,
  }).trim();
}

export function ensurePublishedStableTarget(targetVersion) {
  if (!targetVersion) {
    return;
  }
  ensureCommandAvailable("npm");
  const exactVersion = run(
    "npm",
    ["view", `nextclaw@${targetVersion}`, "version"],
    {
      capture: true,
    },
  ).trim();
  const latestVersion = readPublishedStableVersion();
  if (exactVersion !== targetVersion || latestVersion !== targetVersion) {
    throw new Error(
      `Published stable identity mismatch: exact=${exactVersion || "<missing>"}, latest=${latestVersion || "<missing>"}, expected=${targetVersion}.`,
    );
  }
}

function resolveReleaseNotesPath(version) {
  return resolve(
    ROOT_DIR,
    `apps/docs/public/release-notes/nextclaw-v${version}.json`,
  );
}

function resolveReleaseSurfaceReviewPath(version) {
  return resolve(
    ROOT_DIR,
    `docs/releases/nextclaw-v${version}.release-review.json`,
  );
}

export function inspectReleaseSurfaceReview(previousVersion, targetVersion) {
  if (!previousVersion || !targetVersion) {
    return { issues: [], ready: true, releaseLevel: null, required: false };
  }
  const reviewPath = resolveReleaseSurfaceReviewPath(targetVersion);
  let review = null;
  if (existsSync(reviewPath)) {
    try {
      review = JSON.parse(readFileSync(reviewPath, "utf8"));
    } catch {
      review = null;
    }
  }
  return inspectStableSurfaceReview({
    pathExists: (path) => existsSync(resolve(ROOT_DIR, path)),
    previousVersion,
    review,
    targetVersion,
  });
}

export function hasStructuredReleaseNotes(version) {
  if (!version) {
    return false;
  }
  const releaseNotesPath = resolveReleaseNotesPath(version);
  if (!existsSync(releaseNotesPath)) {
    return false;
  }
  try {
    const metadata = JSON.parse(readFileSync(releaseNotesPath, "utf8"));
    return Boolean(
      metadata?.links?.html?.["en-US"] || metadata?.links?.html?.["zh-CN"],
    );
  } catch {
    return false;
  }
}

export function ensureReleaseBlogsReady(rootDir = ROOT_DIR) {
  const releaseSummary = collectReleaseSummary(rootDir, {
    requireReadyBlogs: true,
  });
  if (releaseSummary.errors.length > 0) {
    throw new Error(
      `Stable release blog preparation is incomplete: ${releaseSummary.errors.join("; ")}`,
    );
  }
}

function ensureNpmPrePublishArtifacts(targetVersion) {
  if (!targetVersion) {
    return;
  }
  const publicKeyPath = resolve(
    ROOT_DIR,
    "packages/nextclaw/resources/update-bundle-public.pem",
  );
  if (!existsSync(publicKeyPath)) {
    throw new Error(`nextclaw package public key is missing: ${publicKeyPath}`);
  }
}

export function ensureProductReleaseArtifacts(previousVersion, targetVersion) {
  if (!targetVersion) {
    return;
  }
  if (!hasStructuredReleaseNotes(targetVersion)) {
    throw new Error(
      `Stable runtime release notes are missing or invalid: ${resolveReleaseNotesPath(targetVersion)}`,
    );
  }
  ensureReleaseBlogsReady();
  const surfaceReview = inspectReleaseSurfaceReview(
    previousVersion,
    targetVersion,
  );
  if (!surfaceReview.ready) {
    throw new Error(
      `Stable ${surfaceReview.releaseLevel} release requires a valid docs/website/X plan at ${resolveReleaseSurfaceReviewPath(targetVersion)}: ${surfaceReview.issues.join("; ")}`,
    );
  }
}

function ensurePackageReleasePrerequisites(branch) {
  ensureCommandAvailable("pnpm");
  ensureCommandAvailable("git");
  ensureCommandAvailable("npm");
  ensureStableCurrentBranch(branch);
  ensureStableCleanWorktree();
  ensureStableRemoteSync(branch);
}

export function ensurePreparedPublishPrerequisites(options) {
  const { branch, targetBranch, trustedPublishing } = options;
  ensureCommandAvailable("pnpm");
  ensureCommandAvailable("git");
  ensureCommandAvailable("npm");
  ensureStableCurrentBranch(branch);
  ensureStableRemoteSync(branch);
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
  if (trustedPublishing) {
    const npmVersion = run("npm", ["--version"], { capture: true }).trim();
    assertTrustedPublishingEnvironment({
      nodeVersion: process.versions.node,
      npmVersion,
    });
    console.log(
      `[release:stable] npm identity: GitHub Actions trusted publishing (node ${process.versions.node}, npm ${npmVersion})`,
    );
    return;
  }
  const npmIdentity = run("npm", ["whoami"], { capture: true }).trim();
  console.log(`[release:stable] npm identity: ${npmIdentity}`);
}

export function configureReleaseNpmUserconfig({ required = false } = {}) {
  const npmUserconfig = resolveReleaseNpmUserconfig({
    commonGitDir: git([
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]),
    configuredUserconfig: process.env.NPM_CONFIG_USERCONFIG,
    currentWorktree: ROOT_DIR,
    pathExists: existsSync,
    required,
  });
  if (!npmUserconfig) {
    console.log(
      "[release:stable] npm userconfig: npm default (no project or explicit config found)",
    );
    return;
  }
  process.env.NPM_CONFIG_USERCONFIG = npmUserconfig;
  console.log(`[release:stable] npm userconfig: ${npmUserconfig}`);
}

function preparePackageRelease(expectedTargetVersion) {
  run("pnpm", ["release:version"]);
  run("pnpm", ["release:check:strict"]);
  run("node", [
    "scripts/release/ensure-pnpm-publish.mjs",
    "--validated-release-batch",
  ]);
  run("pnpm", ["-C", "packages/nextclaw-ui", "prepack"]);
  run("pnpm", ["-C", "packages/nextclaw", "prepack"]);
  return readReleaseCheckpoint(expectedTargetVersion);
}

export function readReleaseCheckpoint(targetVersion) {
  const checkpointRecord = readLatestReleaseCheckpoint();
  if (!checkpointRecord) {
    throw new Error(
      "release:stable could not find the package release checkpoint.",
    );
  }
  const checkpoint = checkpointRecord.checkpoint;
  const checkpointVersion = checkpoint?.packages?.nextclaw?.version ?? null;
  if (targetVersion && checkpointVersion !== targetVersion) {
    throw new Error(
      `Latest release checkpoint nextclaw version ${checkpointVersion ?? "<missing>"} does not match ${targetVersion}.`,
    );
  }
  return checkpoint;
}

function resolvePendingStableExecutionContext(startsAt) {
  const changesetStatus = readChangesetStatus();
  const plan = resolveStableReleasePlan(changesetStatus);
  if (plan.packageCount === 0) {
    throw new Error("release:stable found no pending release packages.");
  }
  const releaseScope = summarizePlannedReleaseScope(changesetStatus);
  let previousVersion = plan.previousVersion;
  if (plan.targetVersion) {
    const publishedStableVersion = readPublishedStableVersion();
    previousVersion = resolveStablePublishedPreviousVersion({
      plannedPreviousVersion: plan.previousVersion,
      publishedStableVersion,
      targetVersion: plan.targetVersion,
    });
  }
  return {
    checkpoint: null,
    npmPublishPackageCount: releaseScope.npmPublishPackageCount,
    packageCount: plan.packageCount,
    previousVersion,
    startsAt,
    targetVersion: plan.targetVersion,
    validationPackageCount: releaseScope.validationPackageCount,
    validationSupportPackageCount: releaseScope.validationSupportPackageCount,
  };
}

function checkpointFromPreparedManifest(manifest) {
  return {
    batchId: manifest.batchId,
    packages: Object.fromEntries(
      manifest.packages.map((entry) => [
        entry.name,
        {
          packageDir: entry.packageDir,
          version: entry.version,
          steps: {},
        },
      ]),
    ),
    validationSupport: {},
  };
}

function resolvePreparedStableExecutionContext(options, startsAt) {
  const record = ensurePreparedNpmReleaseArtifact({
    registry: readNpmRegistry(),
    targetBranch: options.targetBranch,
  });
  const checkpoint = checkpointFromPreparedManifest(record.manifest);
  return {
    checkpoint,
    npmPublishPackageCount: record.manifest.packages.length,
    packageCount: record.manifest.packages.length,
    previousVersion: record.manifest.previousVersion,
    preparedRecord: record,
    startsAt,
    targetVersion: record.manifest.targetVersion,
    validationPackageCount: record.manifest.validationPackageCount,
    validationSupportPackageCount:
      record.manifest.validationSupportPackageCount,
  };
}

export function resolveStableExecutionContext(options) {
  const {
    dryRun,
    prepareOnly,
    previousVersion,
    resumeFrom,
    version: targetVersion,
  } = options;
  validateStableResumeOptions(options);
  const startsAt = STABLE_RELEASE_STAGES.indexOf(resumeFrom);
  if (resumeFrom === "packages") {
    return dryRun || prepareOnly
      ? resolvePendingStableExecutionContext(startsAt)
      : resolvePreparedStableExecutionContext(options, startsAt);
  }
  const checkpoint = dryRun ? readReleaseCheckpoint(targetVersion) : null;
  const npmPublishPackageCount = Object.keys(checkpoint?.packages ?? {}).length;
  const validationSupportPackageCount = Object.keys(
    checkpoint?.validationSupport ?? {},
  ).length;
  return {
    checkpoint,
    npmPublishPackageCount,
    packageCount: npmPublishPackageCount,
    previousVersion,
    startsAt,
    targetVersion,
    validationPackageCount:
      npmPublishPackageCount + validationSupportPackageCount,
    validationSupportPackageCount,
  };
}

export function prepareStableNpmBatch(options) {
  const { artifactOutput, branch, targetBranch } = options;
  validateStableResumeOptions(options);
  ensurePackageReleasePrerequisites(branch);
  run("pnpm", ["release:auto:prepare"]);
  const context = resolvePendingStableExecutionContext(
    STABLE_RELEASE_STAGES.indexOf("packages"),
  );
  const { previousVersion, targetVersion } = context;
  ensureNpmPrePublishArtifacts(targetVersion);
  const checkpoint = preparePackageRelease(targetVersion);
  const record = createPreparedNpmRelease({
    branch,
    checkpoint,
    previousVersion,
    registry: readNpmRegistry(),
    targetBranch,
  });
  console.log("NPM_PREPARED");
  console.log(`- version: ${record.manifest.targetVersion}`);
  console.log(`- package count: ${record.manifest.packages.length}`);
  console.log(`- manifest: ${record.manifestPath}`);
  if (artifactOutput) {
    const artifactDirectory = exportPreparedNpmReleaseArtifact({
      outputDirectory: artifactOutput,
      record,
    });
    console.log(`- reusable artifact: ${artifactDirectory}`);
  }
  console.log("- registry mutation: none");
  return record;
}
