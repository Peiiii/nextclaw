export const STABLE_RELEASE_STAGES = ["packages", "git", "runtime", "install"];
export const STABLE_RELEASE_HELP = `
Usage:
  pnpm release:stable -- [options]

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
  preflight -> strict package release -> release commit/tag/push -> stable runtime -> real install/update
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
  packageCount,
  previousVersion,
  releaseNotesReady,
  resumeFrom,
  skipPublishedInstall,
  skipRuntimeChannel,
  targetVersion,
  worktreeClean
}) {
  const includesNextclaw = Boolean(targetVersion);
  return [
    `- branch: ${branch}`,
    `- worktree clean: ${worktreeClean ? "yes" : "no"}`,
    `- resume from: ${resumeFrom}`,
    `- release packages: ${packageCount}`,
    `- nextclaw version: ${includesNextclaw ? `${previousVersion} -> ${targetVersion}` : "not in batch"}`,
    `- structured release notes: ${includesNextclaw ? (releaseNotesReady ? "ready" : "missing") : "not required"}`,
    resumeFrom === "packages"
      ? "- packages: auto prepare -> version -> strict check -> publish -> registry verify"
      : "- packages: already completed by recovery contract",
    STABLE_RELEASE_STAGES.indexOf(resumeFrom) <= STABLE_RELEASE_STAGES.indexOf("git")
      ? "- git: release commit -> retarget package tags -> push branch/tags"
      : "- git: already completed by recovery contract",
    !includesNextclaw || skipRuntimeChannel
      ? "- stable runtime channel: skipped"
      : "- stable runtime channel: workflow -> release assets -> gh-pages/public manifests",
    !includesNextclaw || skipPublishedInstall
      ? "- published install: skipped"
      : skipRuntimeChannel
        ? "- published install: exact registry package and payload only"
        : "- published install: exact package + previous stable check/download/apply/new process"
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
  return [
    "release:stable completed",
    `- branch: ${branch}`,
    `- package count: ${Object.keys(checkpoint?.packages ?? {}).length}`,
    `- release commit: ${releaseCommit ?? "already closed"}`,
    `- package tags: ${releaseTags.length || "already closed"}`,
    `- nextclaw version: ${targetVersion ?? "not in batch"}`,
    `- stable runtime: ${!targetVersion || skipRuntimeChannel ? "skipped" : "verified"}`,
    `- published install: ${!targetVersion || skipPublishedInstall ? "skipped" : "verified"}`
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
