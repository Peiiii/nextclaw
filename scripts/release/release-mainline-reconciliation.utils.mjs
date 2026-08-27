import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

export const RECONCILIATION_SCHEMA =
  "nextclaw.release-mainline-reconciliation/v1";

export function git(rootDir, args, { capture = true } = {}) {
  const output = execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  return typeof output === "string" ? output.trim() : "";
}

function parseCountPair(value) {
  const [left, right] = value.split(/\s+/).map(Number);
  return { left, right };
}

function readWorktrees(rootDir) {
  return git(rootDir, ["worktree", "list", "--porcelain"])
    .split("\n\n")
    .map((record) => {
      const lines = record.split("\n");
      return {
        branch: lines
          .find((line) => line.startsWith("branch "))
          ?.slice("branch refs/heads/".length),
        path: lines
          .find((line) => line.startsWith("worktree "))
          ?.slice("worktree ".length),
      };
    })
    .filter((record) => record.path);
}

export function readTargetWorktree(rootDir, targetBranch) {
  return (
    readWorktrees(rootDir).find((record) => record.branch === targetBranch)
      ?.path ?? null
  );
}

export function readStatus(rootDir) {
  return git(rootDir, ["--no-optional-locks", "status", "--short"]);
}

export function hasTrackedChanges(status) {
  return status
    .split("\n")
    .filter(Boolean)
    .some((line) => !line.startsWith("?? "));
}

export function readConflictFiles(rootDir) {
  return git(rootDir, ["diff", "--name-only", "--diff-filter=U"])
    .split("\n")
    .filter(Boolean);
}

export function inspectMainlineState({ remote, rootDir, targetBranch }) {
  const remoteRef = `${remote}/${targetBranch}`;
  const localCommit = git(rootDir, ["rev-parse", targetBranch]);
  const remoteCommit = git(rootDir, ["rev-parse", remoteRef]);
  const { left: localOnly, right: remoteOnly } = parseCountPair(
    git(rootDir, [
      "rev-list",
      "--left-right",
      "--count",
      `${targetBranch}...${remoteRef}`,
    ]),
  );
  const targetWorktree = readTargetWorktree(rootDir, targetBranch);
  const worktreeStatus = targetWorktree ? readStatus(targetWorktree) : "";
  return {
    localCommit,
    localOnly,
    remoteCommit,
    remoteOnly,
    targetWorktree,
    trackedWorktreeChanges: hasTrackedChanges(worktreeStatus),
    worktreeDirty: Boolean(worktreeStatus),
    worktreeStatus,
  };
}

export function resolveReconciliationStateDir(rootDir) {
  const commonGitDir = git(rootDir, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  const stateDir = join(commonGitDir, "nextclaw", "release-mainline");
  mkdirSync(stateDir, { recursive: true });
  return stateDir;
}

export function resolveReconciliationWorkerPath(rootDir) {
  const scope = createHash("sha256")
    .update(resolve(rootDir))
    .digest("hex")
    .slice(0, 16);
  return join(resolveReconciliationStateDir(rootDir), `worker-${scope}.json`);
}

export function writeReconciliationReport(rootDir, report) {
  const stateDir = resolveReconciliationStateDir(rootDir);
  writeFileSync(join(stateDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
}

export class ReconciliationReport {
  constructor({ remote, targetBranch }) {
    this.startedAt = new Date();
    this.data = {
      schema: RECONCILIATION_SCHEMA,
      startedAt: this.startedAt.toISOString(),
      targetBranch,
      remote,
      strategy: null,
      attempts: 0,
      phases: [],
      status: null,
    };
  }

  get status() {
    return this.data.status;
  }

  runPhase = (name, callback) => {
    const startedAt = new Date();
    const phase = {
      name,
      startedAt: startedAt.toISOString(),
      status: "running",
    };
    this.data.phases.push(phase);
    try {
      const value = callback();
      phase.status = "completed";
      return value;
    } catch (error) {
      phase.status = "failed";
      phase.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      phase.finishedAt = new Date().toISOString();
      phase.durationMs = Date.now() - startedAt.getTime();
    }
  };

  setInitial = (state) => {
    this.data.initial = state;
  };

  setStrategy = (strategy) => {
    this.data.strategy = strategy;
  };

  setIntegration = (integration) => {
    this.data.integration = integration;
  };

  setAttempt = (attempt) => {
    this.data.attempts = attempt;
  };

  setValidation = (validation) => {
    this.data.validation = validation;
  };

  setConflict = (integration, conflictFiles) => {
    this.data.status = "MAINLINE_RECONCILIATION_RECOVERING";
    this.data.conflictFiles = conflictFiles;
    this.data.recoveryBranch = integration.branch;
    this.data.recoveryWorktree = integration.path;
  };

  setLocalWorktree = (localWorktree) => {
    this.data.localWorktree = localWorktree;
  };

  setRetrying = (worker) => {
    this.data.status = "LOCAL_WORKTREE_RETRYING";
    if (worker) this.data.worker = worker;
  };

  setSynced = () => {
    this.data.status = "LOCAL_MAINLINE_SYNCED";
  };

  setFailed = (error) => {
    this.data.status = "FAILED";
    this.data.error = error instanceof Error ? error.message : String(error);
  };

  finish = (rootDir) => {
    const report = { ...this.data };
    try {
      report.final = inspectMainlineState({
        remote: report.remote,
        rootDir,
        targetBranch: report.targetBranch,
      });
    } catch (error) {
      report.finalInspectionError =
        error instanceof Error ? error.message : String(error);
    }
    report.finishedAt = new Date().toISOString();
    report.durationMs = Date.now() - this.startedAt.getTime();
    report.slowestPhase = report.phases.reduce(
      (slowest, phase) =>
        !slowest || phase.durationMs > slowest.durationMs ? phase : slowest,
      null,
    );
    writeReconciliationReport(rootDir, report);
    return report;
  };
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function spawnReconciliationRetryWorker({
  maxWatchMs,
  pollMs,
  remote,
  rootDir,
  scriptPath,
  targetBranch,
  targetSha,
}) {
  const stateDir = resolveReconciliationStateDir(rootDir);
  const resolvedRootDir = resolve(rootDir);
  const workerPath = resolveReconciliationWorkerPath(resolvedRootDir);
  if (existsSync(workerPath)) {
    try {
      const existing = JSON.parse(readFileSync(workerPath, "utf8"));
      if (existing.rootDir === resolvedRootDir && processIsAlive(existing.pid)) {
        return { pid: existing.pid, reused: true };
      }
    } catch {
      // Replace stale or malformed worker state below.
    }
    rmSync(workerPath, { force: true });
  }

  const logFd = openSync(join(stateDir, "worker.log"), "a");
  const child = spawn(
    process.execPath,
    [
      scriptPath,
      "--watch-child",
      "--root",
      resolvedRootDir,
      "--remote",
      remote,
      "--target",
      targetBranch,
      "--poll-ms",
      String(pollMs),
      "--max-watch-ms",
      String(maxWatchMs),
    ],
    { detached: true, stdio: ["ignore", logFd, logFd] },
  );
  child.unref();
  closeSync(logFd);
  writeFileSync(
    workerPath,
    `${JSON.stringify(
      {
        pid: child.pid,
        rootDir: resolvedRootDir,
        startedAt: new Date().toISOString(),
        targetBranch,
        targetSha,
      },
      null,
      2,
    )}\n`,
  );
  return { pid: child.pid, reused: false };
}
