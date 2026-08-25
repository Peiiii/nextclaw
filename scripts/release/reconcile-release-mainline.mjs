#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  git,
  hasTrackedChanges,
  inspectMainlineState,
  ReconciliationReport,
  readConflictFiles,
  readStatus,
  readTargetWorktree,
  resolveReconciliationStateDir,
  spawnReconciliationRetryWorker,
} from "./release-mainline-reconciliation.utils.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_POLL_MS = 15_000;
const DEFAULT_MAX_WATCH_MS = 0;
const TYPESCRIPT_PATH = /\.(?:cts|mts|ts|tsx)$/;
const NODE_PATH = /\.(?:cjs|mjs)$/;

function run(command, args, { capture = true, cwd } = {}) {
  const output = execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  return typeof output === "string" ? output.trim() : "";
}

function emitReport(report) {
  console.log(JSON.stringify(report));
}

function removeIntegrationWorktree(rootDir, integration) {
  if (!integration) return;
  try {
    git(rootDir, ["worktree", "remove", "--force", integration.path], {
      capture: false,
    });
  } finally {
    try {
      git(rootDir, ["branch", "-D", integration.branch], { capture: false });
    } catch {
      // A retained branch is safer than hiding the original cleanup failure.
    }
  }
}

function createIntegrationWorktree(rootDir, targetBranch) {
  const path = join(
    tmpdir(),
    `nextclaw-mainline-${Date.now()}-${process.pid}`,
  );
  const branch = `codex/reconcile-${targetBranch}-${Date.now()}-${process.pid}`;
  mkdirSync(path, { recursive: true });
  git(rootDir, ["worktree", "add", "-b", branch, path, targetBranch], {
    capture: false,
  });
  return { branch, path };
}

function readCandidateChangedFiles(rootDir, remoteRef) {
  const mergeBase = git(rootDir, ["merge-base", remoteRef, "HEAD"]);
  return git(rootDir, ["diff", "--name-only", `${mergeBase}..HEAD`])
    .split("\n")
    .filter(Boolean);
}

export function validateMainlineCandidate({ rootDir, remoteRef }) {
  git(rootDir, ["diff", "--check", `${remoteRef}..HEAD`]);
  const changedFiles = readCandidateChangedFiles(rootDir, remoteRef);
  for (const file of changedFiles.filter((path) => NODE_PATH.test(path))) {
    run(process.execPath, ["--check", file], { cwd: rootDir });
  }
  if (!changedFiles.some((path) => TYPESCRIPT_PATH.test(path))) {
    return { command: "git diff --check + node --check", typescript: false };
  }
  run(
    "pnpm",
    ["install", "--frozen-lockfile", "--ignore-scripts", "--prefer-offline"],
    { capture: false, cwd: rootDir },
  );
  run("pnpm", ["-C", "packages/nextclaw-kernel", "build"], {
    capture: false,
    cwd: rootDir,
  });
  run("pnpm", ["build"], { capture: false, cwd: rootDir });
  run("pnpm", ["tsc"], { capture: false, cwd: rootDir });
  return {
    command:
      "pnpm install --ignore-scripts && pnpm -C packages/nextclaw-kernel build && pnpm build && pnpm tsc",
    typescript: true,
  };
}

function tryFastForwardTargetWorktree({ remoteRef, rootDir, state, targetBranch }) {
  if (!state.targetWorktree) {
    git(rootDir, ["branch", "-f", targetBranch, remoteRef], {
      capture: false,
    });
    return { completed: true, reason: "target-branch-not-checked-out" };
  }
  if (state.trackedWorktreeChanges) {
    return { completed: false, reason: "tracked-worktree-changes" };
  }
  try {
    git(state.targetWorktree, ["merge", "--ff-only", remoteRef], {
      capture: false,
    });
    return { completed: true, reason: "fast-forwarded" };
  } catch {
    return { completed: false, reason: "worktree-overlap-or-race" };
  }
}

function mergeIntegrationCandidate({
  attempt,
  integration,
  remoteRef,
  report,
}) {
  try {
    report.runPhase(`integration-merge-${attempt}`, () =>
      git(integration.path, ["merge", "--no-edit", remoteRef], {
        capture: false,
      }),
    );
    return true;
  } catch {
    report.setConflict(integration, readConflictFiles(integration.path));
    return false;
  }
}

function pushIntegrationCandidate({
  attempt,
  integration,
  maxPushAttempts,
  remote,
  report,
  targetBranch,
}) {
  try {
    report.runPhase(`push-${attempt}`, () =>
      git(integration.path, ["push", remote, `HEAD:${targetBranch}`], {
        capture: false,
      }),
    );
    return true;
  } catch (error) {
    if (attempt === maxPushAttempts) throw error;
    return false;
  }
}

function integrateCommittedHistory({
  maxPushAttempts,
  remote,
  report,
  rootDir,
  targetBranch,
  validateCandidate,
}) {
  const integration = createIntegrationWorktree(rootDir, targetBranch);
  const remoteRef = `${remote}/${targetBranch}`;
  report.setIntegration(integration);
  for (let attempt = 1; attempt <= maxPushAttempts; attempt += 1) {
    report.setAttempt(attempt);
    report.runPhase(`integration-fetch-${attempt}`, () =>
      git(integration.path, ["fetch", "--no-tags", remote, targetBranch], {
        capture: false,
      }),
    );
    if (!mergeIntegrationCandidate({ attempt, integration, remoteRef, report })) {
      return { integration: null, recovering: true };
    }
    report.setValidation(
      report.runPhase(`validation-${attempt}`, () =>
        validateCandidate({ remoteRef, rootDir: integration.path }),
      ),
    );
    if (
      pushIntegrationCandidate({
        attempt,
        integration,
        maxPushAttempts,
        remote,
        report,
        targetBranch,
      })
    ) {
      return { integration, recovering: false };
    }
  }
  throw new Error("Mainline integration exhausted push attempts.");
}

function synchronizeLocalMirror({
  maxWatchMs,
  pollMs,
  remote,
  report,
  rootDir,
  spawnWorker,
  state,
  targetBranch,
}) {
  if (state.localCommit === state.remoteCommit) return true;
  const fastForward = report.runPhase("local-worktree", () =>
    tryFastForwardTargetWorktree({
      remoteRef: `${remote}/${targetBranch}`,
      rootDir,
      state,
      targetBranch,
    }),
  );
  report.setLocalWorktree(fastForward);
  if (fastForward.completed) return true;
  const worker = spawnWorker
    ? spawnReconciliationRetryWorker({
      maxWatchMs,
      pollMs,
      remote,
      rootDir: resolve(rootDir),
      scriptPath: SCRIPT_PATH,
      targetBranch,
      targetSha: state.remoteCommit,
    })
    : null;
  report.setRetrying(worker);
  return false;
}

export function reconcileReleaseMainline({
  maxPushAttempts = 3,
  maxWatchMs = DEFAULT_MAX_WATCH_MS,
  pollMs = DEFAULT_POLL_MS,
  remote = "origin",
  rootDir = process.cwd(),
  spawnWorker = true,
  targetBranch = "master",
  validateCandidate = validateMainlineCandidate,
} = {}) {
  const report = new ReconciliationReport({ remote, targetBranch });
  let integration = null;
  try {
    report.runPhase("fetch", () =>
      git(rootDir, ["fetch", "--no-tags", remote, targetBranch], {
        capture: false,
      }),
    );
    let state = inspectMainlineState({ remote, rootDir, targetBranch });
    report.setInitial(state);

    if (state.localOnly > 0) {
      report.setStrategy("isolated-merge");
      const integrationResult = integrateCommittedHistory({
        maxPushAttempts,
        remote,
        report,
        rootDir,
        targetBranch,
        validateCandidate,
      });
      integration = integrationResult.integration;
      if (integrationResult.recovering) {
        return report.finish(rootDir);
      }
      report.runPhase("refresh-after-push", () =>
        git(rootDir, ["fetch", "--no-tags", remote, targetBranch], {
          capture: false,
        }),
      );
      state = inspectMainlineState({ remote, rootDir, targetBranch });
    } else {
      report.setStrategy(
        state.remoteOnly > 0 ? "fast-forward" : "already-synced",
      );
    }

    state = inspectMainlineState({ remote, rootDir, targetBranch });
    if (
      !synchronizeLocalMirror({
        maxWatchMs,
        pollMs,
        remote,
        report,
        rootDir,
        spawnWorker,
        state,
        targetBranch,
      })
    ) {
      return report.finish(rootDir);
    }

    report.setSynced();
    return report.finish(rootDir);
  } catch (error) {
    report.setFailed(error);
    return report.finish(rootDir);
  } finally {
    removeIntegrationWorktree(rootDir, integration);
  }
}

function parseArgs(argv) {
  const options = {
    maxWatchMs: DEFAULT_MAX_WATCH_MS,
    pollMs: DEFAULT_POLL_MS,
    remote: "origin",
    rootDir: process.cwd(),
    targetBranch: "master",
    watchChild: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--watch-child") {
      options.watchChild = true;
      continue;
    }
    const key = {
      "--max-watch-ms": "maxWatchMs",
      "--poll-ms": "pollMs",
      "--remote": "remote",
      "--root": "rootDir",
      "--target": "targetBranch",
    }[arg];
    if (!key || !argv[index + 1]) throw new Error(`Unknown or incomplete option: ${arg}`);
    options[key] = ["maxWatchMs", "pollMs"].includes(key)
      ? Number(argv[index + 1])
      : argv[index + 1];
    index += 1;
  }
  return options;
}

async function runWatchChild(options) {
  const { maxWatchMs, pollMs, rootDir, targetBranch } = options;
  const stateDir = resolveReconciliationStateDir(rootDir);
  const workerPath = join(stateDir, "worker.json");
  const deadline = maxWatchMs > 0 ? Date.now() + maxWatchMs : null;
  try {
    while (deadline === null || Date.now() < deadline) {
      const targetWorktree = readTargetWorktree(rootDir, targetBranch);
      if (
        targetWorktree &&
        hasTrackedChanges(readStatus(targetWorktree))
      ) {
        await new Promise((resolvePromise) =>
          setTimeout(resolvePromise, pollMs),
        );
        continue;
      }
      const report = reconcileReleaseMainline({
        ...options,
        spawnWorker: false,
      });
      emitReport(report);
      if (report.status !== "LOCAL_WORKTREE_RETRYING") return report;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, pollMs));
    }
    return null;
  } finally {
    rmSync(workerPath, { force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.watchChild) {
    await runWatchChild(options);
    return;
  }
  const report = reconcileReleaseMainline(options);
  emitReport(report);
  if (["FAILED", "MAINLINE_RECONCILIATION_RECOVERING"].includes(report.status)) {
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === resolve(SCRIPT_PATH)) {
  await main();
}
