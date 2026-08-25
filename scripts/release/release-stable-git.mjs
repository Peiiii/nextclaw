import { execFileSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { reconcileReleaseMainline } from "./reconcile-release-mainline.mjs";

const ROOT_DIR = process.cwd();

export function buildStableReleaseTags(checkpoint) {
  return Object.entries(checkpoint?.packages ?? {})
    .map(([packageName, packageState]) =>
      typeof packageState?.version === "string"
        ? `${packageName}@${packageState.version}`
        : null,
    )
    .filter(Boolean)
    .sort();
}

export function resolveReleaseNpmUserconfig({
  commonGitDir,
  configuredUserconfig,
  currentWorktree,
  pathExists,
  required = false,
}) {
  const resolvedCurrentWorktree = resolve(currentWorktree);
  if (configuredUserconfig?.trim()) {
    return resolve(resolvedCurrentWorktree, configuredUserconfig.trim());
  }
  const currentUserconfig = join(resolvedCurrentWorktree, ".npmrc");
  if (pathExists(currentUserconfig)) return currentUserconfig;
  const resolvedCommonGitDir = resolve(commonGitDir);
  if (basename(resolvedCommonGitDir) !== ".git") {
    if (required) {
      throw new Error(
        "Formal NextClaw NPM release requires an explicit or project .npmrc; refusing ambient ~/.npmrc.",
      );
    }
    return null;
  }
  const primaryWorktree = dirname(resolvedCommonGitDir);
  if (primaryWorktree === resolvedCurrentWorktree) {
    if (required) {
      throw new Error(
        "Formal NextClaw NPM release requires an explicit or project .npmrc; refusing ambient ~/.npmrc.",
      );
    }
    return null;
  }
  const candidate = join(primaryWorktree, ".npmrc");
  if (pathExists(candidate)) return candidate;
  if (required) {
    throw new Error(
      "Formal NextClaw NPM release requires an explicit or project .npmrc; refusing ambient ~/.npmrc.",
    );
  }
  return null;
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: options.rootDir ?? ROOT_DIR,
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"],
  });
  return typeof output === "string" ? output.trim() : "";
}

function git(args, rootDir) {
  return run("git", args, { rootDir });
}

export function ensureStableCurrentBranch(branch, rootDir = ROOT_DIR) {
  const currentBranch = git(["rev-parse", "--abbrev-ref", "HEAD"], rootDir);
  if (currentBranch !== branch) {
    throw new Error(
      `release:stable requires branch ${branch}; current branch is ${currentBranch}.`,
    );
  }
}

export function ensureStableCleanWorktree(rootDir = ROOT_DIR) {
  if (git(["status", "--short"], rootDir)) {
    throw new Error(
      "release:stable requires a clean worktree before package publishing.",
    );
  }
}

export function ensureStableRemoteSync(
  branch,
  { allowLocalAhead = false, rootDir = ROOT_DIR } = {},
) {
  run("git", ["fetch", "origin", branch], { rootDir, capture: false });
  const [remoteOnly, localOnly] = git(
    ["rev-list", "--left-right", "--count", `origin/${branch}...HEAD`],
    rootDir,
  )
    .split(/\s+/)
    .map(Number);
  if (remoteOnly !== 0 || (!allowLocalAhead && localOnly !== 0)) {
    throw new Error(
      `release:stable branch is not synchronized with origin/${branch}: remote-only=${remoteOnly}, local-only=${localOnly}.`,
    );
  }
}

function commitReleaseArtifacts(rootDir) {
  const status = git(["status", "--short"], rootDir);
  if (!status) return git(["rev-parse", "HEAD"], rootDir);
  run("git", ["add", "-A"], { rootDir, capture: false });
  run("git", ["commit", "-m", "chore: release stable batch"], {
    rootDir,
    capture: false,
  });
  return git(["rev-parse", "HEAD"], rootDir);
}

function runDefaultBranchClosure(branch, targetBranch, rootDir) {
  run(
    "pnpm",
    [
      "release:check:branch-closure",
      "--",
      "--target",
      targetBranch,
      "--release",
      branch,
    ],
    { rootDir, capture: false },
  );
}

function resolveReleaseTagCommit(releaseTags, currentCommit, rootDir) {
  const existingCommits = releaseTags.map((tag) => {
    try {
      return git(["rev-list", "-n", "1", `refs/tags/${tag}`], rootDir) || null;
    } catch {
      return null;
    }
  });
  const existingCount = existingCommits.filter(Boolean).length;
  if (existingCount === 0) {
    return { createTags: true, releaseCommit: currentCommit };
  }
  const uniqueCommits = new Set(existingCommits.filter(Boolean));
  if (existingCount !== releaseTags.length || uniqueCommits.size !== 1) {
    throw new Error(
      "Stable release tags are partially present or disagree. Refuse to retarget immutable package identities.",
    );
  }
  return { createTags: false, releaseCommit: [...uniqueCommits][0] };
}

export function closeStableGitReleaseState(options) {
  const {
    branch,
    checkpoint,
    mainlineOptions = {},
    rootDir = ROOT_DIR,
    runBranchClosure = runDefaultBranchClosure,
    targetBranch,
  } = options;
  ensureStableCurrentBranch(branch, rootDir);
  const currentCommit = commitReleaseArtifacts(rootDir);
  const releaseTags = buildStableReleaseTags(checkpoint);
  const { createTags, releaseCommit } = resolveReleaseTagCommit(
    releaseTags,
    currentCommit,
    rootDir,
  );
  if (createTags) {
    for (const tag of releaseTags) {
      run("git", ["tag", tag, releaseCommit], { rootDir, capture: false });
    }
  }
  run("git", ["fetch", "origin", targetBranch], { rootDir, capture: false });
  try {
    git(
      ["merge-base", "--is-ancestor", `origin/${targetBranch}`, "HEAD"],
      rootDir,
    );
  } catch {
    run("git", ["merge", "--no-edit", `origin/${targetBranch}`], {
      rootDir,
      capture: false,
    });
  }
  const closureCommit = git(["rev-parse", "HEAD"], rootDir);
  const branchRefspecs = new Set([`HEAD:${branch}`, `HEAD:${targetBranch}`]);
  run(
    "git",
    [
      "push",
      "--atomic",
      "origin",
      ...branchRefspecs,
      ...releaseTags.map((tag) => `refs/tags/${tag}`),
    ],
    { rootDir, capture: false },
  );
  runBranchClosure(branch, `origin/${targetBranch}`, rootDir);
  const mainlineReconciliation = reconcileReleaseMainline({
    ...mainlineOptions,
    rootDir,
    targetBranch,
  });
  if (
    ["FAILED", "MAINLINE_RECONCILIATION_RECOVERING"].includes(
      mainlineReconciliation.status,
    )
  ) {
    throw new Error(
      `Stable release mainline reconciliation failed: ${mainlineReconciliation.status}`,
    );
  }
  git(
    [
      "merge-base",
      "--is-ancestor",
      closureCommit,
      `origin/${targetBranch}`,
    ],
    rootDir,
  );
  return {
    closureCommit,
    mainlineReconciliation,
    releaseCommit,
    releaseTags,
  };
}
