export const STABLE_RELEASE_STAGES = ["packages", "git", "runtime", "install"];
export const STABLE_RELEASE_HELP = `
Usage:
  pnpm release:stable -- [options]
  pnpm release:npm:stable -- [options]
  pnpm release:product:stable -- [options]

Options:
  --dry-run                             Print the complete stable closure without mutation
  --prepare-only                        Build and validate immutable tarballs without publishing
  --artifact-output <directory>         Export a prepared artifact for exact-commit reuse
  --branch <branch>                     Branch to require and push (default: master)
  --target-branch <branch>              Branch that must receive the release (default: master)
  --publish-concurrency <count>         Concurrent prepared tarball uploads (default: 12)
  --verify-concurrency <count>          Concurrent registry reads (default: 8)
  --max-publish-seconds <seconds>       NPM_READY hard limit (default: 60)
  --skip-runtime-channel                Publish NPM without opening the stable runtime channel
  --skip-published-install              Skip exact registry payload/update verification
  --release-tag <tag>                   Override the runtime GitHub release tag
  --minimum-launcher-version-override <version>
                                        Recovery-only runtime compatibility override
  --resume-from <git|runtime|install>   Resume after an already completed irreversible stage
  --version <version>                   Required for recovery
  --previous-version <version>          Required for recovery install/update verification
  --help                                Show this help

Default closure:
  prepared tarball proof -> concurrent publish -> registry verify
  -> release commit/tag/target push + exact registry payload audit
  -> NPM_READY -> product materials -> stable runtime -> previous-version update
`.trim();

export function parseStableReleaseArgs(argv) {
  const normalizedArgv = argv.filter((arg) => arg !== "--");
  const options = {
    artifactOutput: null,
    branch: "master",
    dryRun: false,
    help: false,
    minimumLauncherVersionOverride: null,
    maxPublishSeconds: 60,
    previousVersion: null,
    prepareOnly: false,
    publishConcurrency: 12,
    releaseTag: null,
    resumeFrom: "packages",
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
    targetBranch: "master",
    verifyConcurrency: 8,
    version: null,
  };

  for (let index = 0; index < normalizedArgv.length; index += 1) {
    const arg = normalizedArgv[index];
    switch (arg) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--prepare-only":
        options.prepareOnly = true;
        break;
      case "--skip-published-install":
        options.skipPublishedInstall = true;
        break;
      case "--skip-runtime-channel":
        options.skipRuntimeChannel = true;
        break;
      case "--branch":
        options.branch = normalizedArgv[index + 1] ?? "";
        index += 1;
        break;
      case "--artifact-output":
        options.artifactOutput = normalizedArgv[index + 1] ?? "";
        index += 1;
        break;
      case "--minimum-launcher-version-override":
        options.minimumLauncherVersionOverride =
          normalizedArgv[index + 1] ?? "";
        index += 1;
        break;
      case "--max-publish-seconds":
        options.maxPublishSeconds = Number(normalizedArgv[index + 1]);
        index += 1;
        break;
      case "--previous-version":
        options.previousVersion = normalizedArgv[index + 1] ?? "";
        index += 1;
        break;
      case "--release-tag":
        options.releaseTag = normalizedArgv[index + 1] ?? "";
        index += 1;
        break;
      case "--publish-concurrency":
        options.publishConcurrency = Number(normalizedArgv[index + 1]);
        index += 1;
        break;
      case "--resume-from":
        options.resumeFrom = normalizedArgv[index + 1] ?? "";
        index += 1;
        break;
      case "--target-branch":
        options.targetBranch = normalizedArgv[index + 1] ?? "";
        index += 1;
        break;
      case "--verify-concurrency":
        options.verifyConcurrency = Number(normalizedArgv[index + 1]);
        index += 1;
        break;
      case "--version":
        options.version = normalizedArgv[index + 1] ?? "";
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  for (const key of [
    "artifactOutput",
    "branch",
    "minimumLauncherVersionOverride",
    "previousVersion",
    "releaseTag",
    "resumeFrom",
    "targetBranch",
    "version",
  ]) {
    if (typeof options[key] === "string") {
      options[key] = options[key].trim() || null;
    }
  }
  if (!options.branch) {
    throw new Error("--branch requires a non-empty value.");
  }
  if (!options.targetBranch) {
    throw new Error("--target-branch requires a non-empty value.");
  }
  if (options.artifactOutput && !options.prepareOnly) {
    throw new Error("--artifact-output requires --prepare-only.");
  }
  for (const key of [
    "maxPublishSeconds",
    "publishConcurrency",
    "verifyConcurrency",
  ]) {
    if (!Number.isFinite(options[key]) || options[key] <= 0) {
      throw new Error(
        `--${key.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)} requires a positive number.`,
      );
    }
  }
  if (!STABLE_RELEASE_STAGES.includes(options.resumeFrom)) {
    throw new Error(
      `Unsupported --resume-from stage: ${options.resumeFrom ?? "<empty>"}`,
    );
  }
  return options;
}

export function resolveStableReleasePlan(changesetStatus) {
  if (changesetStatus?.preState) {
    throw new Error(
      "release:stable cannot run while Changesets pre mode is active.",
    );
  }
  const releases = Array.isArray(changesetStatus?.releases)
    ? changesetStatus.releases
    : [];
  const nextclawRelease =
    releases.find((entry) => entry.name === "nextclaw") ?? null;
  return {
    packageCount: releases.length,
    previousVersion: nextclawRelease?.oldVersion ?? null,
    targetVersion: nextclawRelease?.newVersion ?? null,
  };
}

export {
  inspectStableSurfaceReview,
  resolveStableReleaseLevel,
} from "./release-stable-surface.mjs";
export {
  buildStableReleaseTags,
  resolveReleaseNpmUserconfig,
} from "./release-stable-git.mjs";

export function validateStableResumeOptions(options) {
  const {
    previousVersion,
    resumeFrom,
    skipPublishedInstall,
    skipRuntimeChannel,
    version,
  } = options;
  if (options.prepareOnly && resumeFrom !== "packages") {
    throw new Error("--prepare-only cannot be combined with --resume-from.");
  }
  if (resumeFrom === "packages") {
    return;
  }
  if (!version) {
    throw new Error(`--resume-from ${resumeFrom} requires --version.`);
  }
  if (!skipPublishedInstall && !skipRuntimeChannel && !previousVersion) {
    throw new Error(
      `--resume-from ${resumeFrom} requires --previous-version unless runtime or install validation is skipped.`,
    );
  }
}

export function buildStableDryRunPlan({
  branch,
  npmPublishPackageCount = 0,
  packageCount,
  previousVersion,
  releaseNotesReady,
  surfaceReviewReady,
  surfaceReviewRequired,
  resumeFrom,
  skipPublishedInstall,
  skipRuntimeChannel,
  targetVersion,
  targetBranch = "master",
  validationPackageCount = 0,
  validationSupportPackageCount = 0,
  worktreeClean,
}) {
  const includesNextclaw = Boolean(targetVersion);
  return [
    `- branch: ${branch}`,
    `- target branch: ${targetBranch}`,
    `- worktree clean: ${worktreeClean ? "yes" : "no"}`,
    `- resume from: ${resumeFrom}`,
    `- version changes: ${packageCount}`,
    `- npm publish packages: ${npmPublishPackageCount}`,
    `- validation closure: ${validationPackageCount} workspace package(s)`,
    `- validation support packages: ${validationSupportPackageCount}`,
    `- nextclaw version: ${includesNextclaw ? `${previousVersion} -> ${targetVersion}` : "not in batch"}`,
    `- structured release notes: ${
      !includesNextclaw || skipRuntimeChannel
        ? "not in NPM scope"
        : releaseNotesReady
          ? "ready for runtime"
          : "missing (blocks runtime, not NPM)"
    }`,
    `- docs/website/X release plan: ${
      !includesNextclaw || skipRuntimeChannel
        ? "not in NPM scope"
        : !surfaceReviewRequired
          ? "not required"
          : surfaceReviewReady
            ? "ready for product closure"
            : "missing or invalid (blocks product closure, not NPM)"
    }`,
    resumeFrom === "packages"
      ? "- packages: prepared tarball proof -> concurrent publish -> concurrent registry verify"
      : "- packages: already completed by recovery contract",
    STABLE_RELEASE_STAGES.indexOf(resumeFrom) <=
    STABLE_RELEASE_STAGES.indexOf("git")
      ? "- git: release commit -> create immutable package tags -> push branch/tags"
      : "- git: already completed by recovery contract",
    !includesNextclaw || skipPublishedInstall
      ? "- NPM_READY gate: registry package batch only; exact nextclaw payload audit not applicable or skipped"
      : "- NPM_READY gate: empty-cache exact registry tarball download and payload audit",
    !includesNextclaw || skipRuntimeChannel
      ? "- stable runtime channel: skipped"
      : "- stable runtime channel: workflow -> release assets -> gh-pages/public manifests",
    !includesNextclaw || skipPublishedInstall
      ? "- published install: skipped"
      : skipRuntimeChannel
        ? "- published verification: exact registry tarball and payload only"
        : "- published update: previous stable check/download/apply/new process",
    "- desktop: excluded",
  ];
}

export function buildStableNpmTimingSummary({
  checkpoint,
  durationMs,
  phaseTimings,
  publishSummary,
  skipPublishedInstall = false,
  status = "NPM_READY",
  targetBranch,
  targetVersion,
}) {
  return [
    status,
    `- channel: stable/latest`,
    `- package count: ${Object.keys(checkpoint?.packages ?? {}).length}`,
    `- tarballs uploaded now: ${publishSummary?.publishedCount ?? "not recorded"}`,
    `- versions already visible: ${publishSummary?.reusedCount ?? "not recorded"}`,
    `- nextclaw version: ${targetVersion ?? "not in batch"}`,
    `- registry verification: passed${publishSummary?.attemptsUsed ? ` (${publishSummary.attemptsUsed} attempt(s))` : ""}`,
    `- timing: artifact ${formatDuration(phaseTimings?.artifactResolutionMs)}, package phase ${formatDuration(phaseTimings?.packagePhaseMs)}, Git/install join ${formatDuration(phaseTimings?.postPublishClosureMs)}`,
    `- package timing: precheck ${formatDuration(publishSummary?.timings?.precheckMs)}, upload ${formatDuration(publishSummary?.timings?.uploadMs)}, verify ${formatDuration(publishSummary?.timings?.verifyMs)}`,
    `- exact nextclaw registry payload: ${!targetVersion ? "not applicable" : skipPublishedInstall ? "skipped" : "passed"}`,
    `- target branch: ${targetBranch ?? "master"}`,
    `- publish duration: ${typeof durationMs === "number" ? `${(durationMs / 1000).toFixed(2)}s` : "not recorded"}`,
    `- remaining product stages: runtime, applicable docs/website/X; desktop excluded`,
  ];
}

function formatDuration(durationMs) {
  return typeof durationMs === "number"
    ? `${(durationMs / 1000).toFixed(2)}s`
    : "not recorded";
}

export function resolveNpmReadyStatus(durationMs, maxPublishSeconds) {
  return Number.isFinite(durationMs) && durationMs < maxPublishSeconds * 1000
    ? "NPM_READY"
    : "NPM_SLA_MISSED";
}

export function assertNpmReadyWithinBudget(durationMs, maxPublishSeconds) {
  if (resolveNpmReadyStatus(durationMs, maxPublishSeconds) !== "NPM_READY") {
    throw new Error(
      `NPM publish exceeded the ${maxPublishSeconds}s completion budget: ${(durationMs / 1000).toFixed(2)}s`,
    );
  }
}

export function buildStableCompletionSummary({
  branch,
  checkpoint,
  releaseCommit,
  releaseTags,
  skipPublishedInstall,
  skipRuntimeChannel,
  targetVersion,
}) {
  const npmReady = !targetVersion || !skipPublishedInstall;
  const productCoreReady =
    npmReady && Boolean(targetVersion) && !skipRuntimeChannel;
  return [
    productCoreReady
      ? "release:product:stable core stages completed"
      : npmReady
        ? "NPM_READY"
        : "RELEASE_PARTIAL",
    `- branch: ${branch}`,
    `- package count: ${Object.keys(checkpoint?.packages ?? {}).length}`,
    `- release commit: ${releaseCommit ?? "already closed"}`,
    `- package tags: ${releaseTags.length || "already closed"}`,
    `- nextclaw version: ${targetVersion ?? "not in batch"}`,
    `- stable runtime: ${!targetVersion || skipRuntimeChannel ? "skipped" : "verified"}`,
    `- published install: ${!targetVersion || skipPublishedInstall ? "skipped" : "verified"}`,
    `- NEXTCLAW_STABLE_READY: ${productCoreReady ? "pending applicable docs/website/X owner closure" : "not applicable"}`,
    `- desktop: excluded`,
  ];
}

export function formatStableRecoveryCommand(stage, options) {
  const {
    branch,
    minimumLauncherVersionOverride,
    previousVersion,
    releaseTag,
    skipPublishedInstall,
    skipRuntimeChannel,
    targetBranch,
    version,
  } = options;
  const args = ["pnpm release:stable --", "--resume-from", stage];
  if (version) {
    args.push("--version", version);
  }
  if (previousVersion) {
    args.push("--previous-version", previousVersion);
  }
  if (branch && branch !== "master") {
    args.push("--branch", branch);
  }
  if (targetBranch && targetBranch !== "master") {
    args.push("--target-branch", targetBranch);
  }
  if (skipRuntimeChannel) {
    args.push("--skip-runtime-channel");
  }
  if (skipPublishedInstall) {
    args.push("--skip-published-install");
  }
  if (releaseTag) {
    args.push("--release-tag", releaseTag);
  }
  if (minimumLauncherVersionOverride) {
    args.push(
      "--minimum-launcher-version-override",
      minimumLauncherVersionOverride,
    );
  }
  return args.join(" ");
}

export function buildStableRuntimeCommandArgs(branch, targetVersion, options) {
  const { minimumLauncherVersionOverride, releaseTag, skipRuntimeChannel } =
    options;
  if (!targetVersion || skipRuntimeChannel) {
    return null;
  }
  const args = [
    "release:stable:runtime",
    "--",
    "--branch",
    branch,
    "--version",
    targetVersion,
  ];
  if (releaseTag) {
    args.push("--release-tag", releaseTag);
  }
  if (minimumLauncherVersionOverride) {
    args.push(
      "--minimum-launcher-version-override",
      minimumLauncherVersionOverride,
    );
  }
  return args;
}

export function buildStablePublishedInstallArgs(
  targetVersion,
  previousVersion,
  options,
) {
  const { skipPublishedInstall, skipRuntimeChannel } = options;
  if (!targetVersion || skipPublishedInstall) {
    return null;
  }
  const args = [
    "-C",
    "packages/nextclaw",
    "validation:npm-update",
    "--",
    "--published-stable",
    "--expected-version",
    targetVersion,
  ];
  if (!skipRuntimeChannel && previousVersion) {
    args.push("--previous-version", previousVersion);
  }
  args.push("--package-only");
  return args;
}

export function buildStablePublishedUpgradeArgs(
  targetVersion,
  previousVersion,
  options,
) {
  const { skipPublishedInstall, skipRuntimeChannel } = options;
  if (!targetVersion || !previousVersion) return null;
  if (skipPublishedInstall || skipRuntimeChannel) return null;
  return [
    "-C",
    "packages/nextclaw",
    "validation:npm-update",
    "--",
    "--published-stable",
    "--expected-version",
    targetVersion,
    "--previous-version",
    previousVersion,
    "--update-only",
  ];
}
