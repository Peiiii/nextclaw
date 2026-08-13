import { basename, dirname, join, resolve } from "node:path";

export const STABLE_RELEASE_STAGES = ["packages", "git", "runtime", "install"];
export const STABLE_RELEASE_HELP = `
Usage:
  pnpm release:stable -- [options]
  pnpm release:npm:stable -- [options]
  pnpm release:product:stable -- [options]

Options:
  --dry-run                             Print the complete stable closure without mutation
  --branch <branch>                     Branch to require and push (default: master)
  --skip-runtime-channel                Publish NPM without opening the stable runtime channel
  --skip-published-install              Skip real registry install/update verification
  --release-tag <tag>                   Override the runtime GitHub release tag
  --minimum-launcher-version-override <version>
                                        Recovery-only runtime compatibility override
  --resume-from <git|runtime|install>   Resume after an already completed irreversible stage
  --version <version>                   Required for recovery
  --previous-version <version>          Required for recovery install/update verification
  --help                                Show this help

Default closure:
  preflight -> strict package release -> release commit/tag/push -> exact registry install
  -> NPM_READY -> product materials -> stable runtime -> previous-version update
`.trim();

export function parseStableReleaseArgs(argv) {
  const normalizedArgv = argv.filter((arg) => arg !== "--");
  const options = {
    branch: "master",
    dryRun: false,
    help: false,
    minimumLauncherVersionOverride: null,
    previousVersion: null,
    releaseTag: null,
    resumeFrom: "packages",
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
    version: null
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
      case "--minimum-launcher-version-override":
        options.minimumLauncherVersionOverride = normalizedArgv[index + 1] ?? "";
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
      case "--resume-from":
        options.resumeFrom = normalizedArgv[index + 1] ?? "";
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
    "branch",
    "minimumLauncherVersionOverride",
    "previousVersion",
    "releaseTag",
    "resumeFrom",
    "version"
  ]) {
    if (typeof options[key] === "string") {
      options[key] = options[key].trim() || null;
    }
  }
  if (!options.branch) {
    throw new Error("--branch requires a non-empty value.");
  }
  if (!STABLE_RELEASE_STAGES.includes(options.resumeFrom)) {
    throw new Error(`Unsupported --resume-from stage: ${options.resumeFrom ?? "<empty>"}`);
  }
  return options;
}

export function resolveStableReleasePlan(changesetStatus) {
  if (changesetStatus?.preState) {
    throw new Error("release:stable cannot run while Changesets pre mode is active.");
  }
  const releases = Array.isArray(changesetStatus?.releases) ? changesetStatus.releases : [];
  const nextclawRelease = releases.find((entry) => entry.name === "nextclaw") ?? null;
  return {
    packageCount: releases.length,
    previousVersion: nextclawRelease?.oldVersion ?? null,
    targetVersion: nextclawRelease?.newVersion ?? null
  };
}

function parseStableVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? "");
  if (!match) {
    throw new Error(`Expected a stable semantic version, received ${version ?? "<missing>"}.`);
  }
  return match.slice(1).map(Number);
}

export function resolveStableReleaseLevel(previousVersion, targetVersion) {
  const [previousMajor, previousMinor] = parseStableVersion(previousVersion);
  const [targetMajor, targetMinor] = parseStableVersion(targetVersion);
  if (targetMajor > previousMajor) {
    return "major";
  }
  if (targetMajor === previousMajor && targetMinor > previousMinor) {
    return "minor";
  }
  return "patch";
}

function collectSocialPostReviewIssues({ pathExists, releaseLevel, socialPost }) {
  const issues = [];
  const allowedDecisions = releaseLevel === "minor" ? ["publish"] : ["publish", "not-needed"];
  if (!socialPost || !allowedDecisions.includes(socialPost.decision)) {
    issues.push(`social post decision must be ${allowedDecisions.join(" or ")}`);
    return issues;
  }
  if (socialPost.decision === "not-needed") {
    if (typeof socialPost.reason !== "string" || !socialPost.reason.trim()) {
      issues.push("social post not-needed decision requires a reason");
    }
    return issues;
  }
  for (const field of ["account", "text", "imagePath", "imageAlt", "releaseNotesUrl"]) {
    if (typeof socialPost[field] !== "string" || !socialPost[field].trim()) {
      issues.push(`social post ${field} is required`);
    }
  }
  if (socialPost.channel !== "x") issues.push("social post channel must be x");
  if (socialPost.account && !/^@[A-Za-z0-9_]{1,15}$/.test(socialPost.account)) {
    issues.push("social post account must be an X handle");
  }
  if (socialPost.text?.length > 280) issues.push("social post text must be at most 280 characters");
  if (socialPost.releaseNotesUrl && !socialPost.text?.includes(socialPost.releaseNotesUrl)) {
    issues.push("social post text must include releaseNotesUrl");
  }
  if (socialPost.imagePath && !pathExists(socialPost.imagePath)) {
    issues.push(`social post imagePath does not exist: ${socialPost.imagePath}`);
  }
  return issues;
}

function collectReleaseIdentityIssues({ releaseLevel, review, targetVersion }) {
  const issues = [];
  if (review.version !== targetVersion) {
    issues.push(`review version must be ${targetVersion}`);
  }
  if (review.releaseType !== releaseLevel) {
    issues.push(`review releaseType must be ${releaseLevel}`);
  }
  return issues;
}

export function inspectStableSurfaceReview({
  pathExists,
  previousVersion,
  review,
  targetVersion
}) {
  const releaseLevel = resolveStableReleaseLevel(previousVersion, targetVersion);
  const required = releaseLevel === "major" || releaseLevel === "minor";
  if (!required) {
    return { issues: [], ready: true, releaseLevel, required };
  }

  const issues = [];
  if (!review || typeof review !== "object") {
    issues.push("release review is missing");
    return { issues, ready: false, releaseLevel, required };
  }
  issues.push(...collectReleaseIdentityIssues({ releaseLevel, review, targetVersion }));

  for (const [surfaceKey, label] of [
    ["docsSite", "docs site"],
    ["website", "website"]
  ]) {
    const surface = review.surfaces?.[surfaceKey];
    if (!surface || !["updated", "not-needed"].includes(surface.decision)) {
      issues.push(`${label} decision must be updated or not-needed`);
      continue;
    }
    if (surface.decision === "not-needed") {
      if (typeof surface.reason !== "string" || !surface.reason.trim()) {
        issues.push(`${label} not-needed decision requires a reason`);
      }
      continue;
    }
    const paths = Array.isArray(surface.paths) ? surface.paths : [];
    if (paths.length === 0) {
      issues.push(`${label} updated decision requires at least one path`);
      continue;
    }
    for (const path of paths) {
      if (typeof path !== "string" || !path.trim() || path.startsWith("/") || path.includes("..")) {
        issues.push(`${label} contains an invalid repository-relative path`);
      } else if (!pathExists(path)) {
        issues.push(`${label} path does not exist: ${path}`);
      }
    }
  }

  issues.push(...collectSocialPostReviewIssues({
    pathExists,
    releaseLevel,
    socialPost: review.surfaces?.socialPost
  }));

  return { issues, ready: issues.length === 0, releaseLevel, required };
}

export function resolveLinkedWorktreeNpmUserconfig({
  commonGitDir,
  configuredUserconfig,
  currentWorktree,
  pathExists
}) {
  if (configuredUserconfig?.trim()) {
    return null;
  }
  const resolvedCurrentWorktree = resolve(currentWorktree);
  if (pathExists(join(resolvedCurrentWorktree, ".npmrc"))) {
    return null;
  }
  const resolvedCommonGitDir = resolve(commonGitDir);
  if (basename(resolvedCommonGitDir) !== ".git") {
    return null;
  }
  const primaryWorktree = dirname(resolvedCommonGitDir);
  if (primaryWorktree === resolvedCurrentWorktree) {
    return null;
  }
  const candidate = join(primaryWorktree, ".npmrc");
  return pathExists(candidate) ? candidate : null;
}

export function validateStableResumeOptions(options) {
  const {
    previousVersion,
    resumeFrom,
    skipPublishedInstall,
    skipRuntimeChannel,
    version
  } = options;
  if (resumeFrom === "packages") {
    return;
  }
  if (!version) {
    throw new Error(`--resume-from ${resumeFrom} requires --version.`);
  }
  if (!skipPublishedInstall && !skipRuntimeChannel && !previousVersion) {
    throw new Error(
      `--resume-from ${resumeFrom} requires --previous-version unless runtime or install validation is skipped.`
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
  validationPackageCount = 0,
  validationSupportPackageCount = 0,
  worktreeClean
}) {
  const includesNextclaw = Boolean(targetVersion);
  return [
    `- branch: ${branch}`,
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
      ? "- packages: auto prepare -> version -> strict check -> reuse validated builds -> publish -> registry verify"
      : "- packages: already completed by recovery contract",
    STABLE_RELEASE_STAGES.indexOf(resumeFrom) <= STABLE_RELEASE_STAGES.indexOf("git")
      ? "- git: release commit -> retarget package tags -> push branch/tags"
      : "- git: already completed by recovery contract",
    !includesNextclaw || skipPublishedInstall
      ? "- NPM_READY gate: registry package batch only; exact nextclaw install not applicable or skipped"
      : "- NPM_READY gate: exact public-registry cold install before product materials/runtime",
    !includesNextclaw || skipRuntimeChannel
      ? "- stable runtime channel: skipped"
      : "- stable runtime channel: workflow -> release assets -> gh-pages/public manifests",
    !includesNextclaw || skipPublishedInstall
      ? "- published install: skipped"
      : skipRuntimeChannel
        ? "- published install: exact registry package and payload only"
        : "- published update: previous stable check/download/apply/new process",
    "- desktop: excluded"
  ];
}

export function buildStableNpmReadySummary({ checkpoint, targetVersion }) {
  return [
    "NPM_READY",
    `- channel: stable/latest`,
    `- package count: ${Object.keys(checkpoint?.packages ?? {}).length}`,
    `- nextclaw version: ${targetVersion ?? "not in batch"}`,
    `- registry verification: passed`,
    `- exact nextclaw install: ${targetVersion ? "passed" : "not applicable"}`,
    `- remaining product stages: runtime, applicable docs/website/X; desktop excluded`
  ];
}

export function buildStableCompletionSummary({
  branch,
  checkpoint,
  releaseCommit,
  releaseTags,
  skipPublishedInstall,
  skipRuntimeChannel,
  targetVersion
}) {
  const npmReady = !targetVersion || !skipPublishedInstall;
  const productCoreReady = npmReady && Boolean(targetVersion) && !skipRuntimeChannel;
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
    `- desktop: excluded`
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
    version
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
    args.push("--minimum-launcher-version-override", minimumLauncherVersionOverride);
  }
  return args.join(" ");
}

export function buildStableReleaseTags(checkpoint) {
  return Object.entries(checkpoint?.packages ?? {})
    .map(([packageName, packageState]) =>
      typeof packageState?.version === "string" ? `${packageName}@${packageState.version}` : null
    )
    .filter(Boolean)
    .sort();
}

export function buildStableRuntimeCommandArgs(branch, targetVersion, options) {
  const { minimumLauncherVersionOverride, releaseTag, skipRuntimeChannel } = options;
  if (!targetVersion || skipRuntimeChannel) {
    return null;
  }
  const args = [
    "release:stable:runtime",
    "--",
    "--branch",
    branch,
    "--version",
    targetVersion
  ];
  if (releaseTag) {
    args.push("--release-tag", releaseTag);
  }
  if (minimumLauncherVersionOverride) {
    args.push("--minimum-launcher-version-override", minimumLauncherVersionOverride);
  }
  return args;
}

export function buildStablePublishedInstallArgs(targetVersion, previousVersion, options) {
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
    targetVersion
  ];
  if (!skipRuntimeChannel && previousVersion) {
    args.push("--previous-version", previousVersion);
  }
  return args;
}

export function buildStablePublishedUpgradeArgs(targetVersion, previousVersion, options) {
  const { skipPublishedInstall, skipRuntimeChannel } = options;
  if (!targetVersion || !previousVersion || skipPublishedInstall || skipRuntimeChannel) {
    return null;
  }
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
    "--update-only"
  ];
}
