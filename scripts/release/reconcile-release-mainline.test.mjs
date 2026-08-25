import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { reconcileReleaseMainline } from "./reconcile-release-mainline.mjs";

function git(rootDir, args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commitFile(rootDir, path, contents, message) {
  writeFileSync(join(rootDir, path), contents);
  git(rootDir, ["add", path]);
  git(rootDir, ["commit", "-m", message]);
  return git(rootDir, ["rev-parse", "HEAD"]);
}

function createFixture(context) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mainline-reconcile-test-"));
  context.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const remote = join(fixtureRoot, "remote.git");
  const repository = join(fixtureRoot, "repository");
  const upstream = join(fixtureRoot, "upstream");

  execFileSync("git", ["init", "--bare", remote], { stdio: "ignore" });
  execFileSync("git", ["init", "--initial-branch", "master", repository], {
    stdio: "ignore",
  });
  git(repository, ["config", "user.name", "Mainline Test"]);
  git(repository, ["config", "user.email", "mainline@example.test"]);
  commitFile(repository, "shared.txt", "initial\n", "initial");
  git(repository, ["remote", "add", "origin", remote]);
  git(repository, ["push", "-u", "origin", "master"]);

  execFileSync("git", ["clone", "--branch", "master", remote, upstream], {
    stdio: "ignore",
  });
  git(upstream, ["config", "user.name", "Upstream Test"]);
  git(upstream, ["config", "user.email", "upstream@example.test"]);
  return { remote, repository, upstream };
}

function reconcile(repository) {
  return reconcileReleaseMainline({
    rootDir: repository,
    spawnWorker: false,
    validateCandidate: () => ({ command: "fixture-validation", typescript: false }),
  });
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

test("reports an already synchronized mainline idempotently", (context) => {
  const { repository } = createFixture(context);
  const report = reconcile(repository);

  assert.equal(report.schema, "nextclaw.release-mainline-reconciliation/v1");
  assert.equal(report.strategy, "already-synced");
  assert.equal(report.status, "LOCAL_MAINLINE_SYNCED");
  assert.equal(report.initial.localOnly, 0);
  assert.equal(report.initial.remoteOnly, 0);
});

test("merges divergent committed history in isolation and fast-forwards the local mirror", (context) => {
  const { repository, upstream } = createFixture(context);
  const localCommit = commitFile(repository, "local.txt", "local\n", "local work");
  const remoteCommit = commitFile(upstream, "remote.txt", "remote\n", "remote release");
  git(upstream, ["push", "origin", "master"]);

  const report = reconcile(repository);
  const finalCommit = git(repository, ["rev-parse", "HEAD"]);

  assert.equal(report.strategy, "isolated-merge");
  assert.equal(report.status, "LOCAL_MAINLINE_SYNCED");
  assert.equal(report.initial.localOnly, 1);
  assert.equal(report.initial.remoteOnly, 1);
  assert.doesNotThrow(() =>
    git(repository, ["merge-base", "--is-ancestor", localCommit, finalCommit]),
  );
  assert.doesNotThrow(() =>
    git(repository, ["merge-base", "--is-ancestor", remoteCommit, finalCommit]),
  );
  assert.equal(git(repository, ["rev-parse", "origin/master"]), finalCommit);
});

test("refetches, revalidates, and retries after a concurrent remote push", (context) => {
  const { repository, upstream } = createFixture(context);
  const localCommit = commitFile(repository, "local.txt", "local\n", "local work");
  let validationAttempts = 0;

  const report = reconcileReleaseMainline({
    rootDir: repository,
    spawnWorker: false,
    validateCandidate: () => {
      validationAttempts += 1;
      if (validationAttempts === 1) {
        commitFile(upstream, "race.txt", "race\n", "concurrent remote work");
        git(upstream, ["push", "origin", "master"]);
      }
      return { command: "fixture-validation", typescript: false };
    },
  });
  const finalCommit = git(repository, ["rev-parse", "HEAD"]);

  assert.equal(report.status, "LOCAL_MAINLINE_SYNCED");
  assert.equal(report.attempts, 2);
  assert.equal(validationAttempts, 2);
  assert.doesNotThrow(() =>
    git(repository, ["merge-base", "--is-ancestor", localCommit, finalCommit]),
  );
  assert.equal(readFileSync(join(repository, "race.txt"), "utf8"), "race\n");
});

test("keeps tracked and staged edits untouched while an automatic retry is pending", (context) => {
  const { repository, upstream } = createFixture(context);
  commitFile(upstream, "remote.txt", "remote\n", "remote release");
  git(upstream, ["push", "origin", "master"]);
  writeFileSync(join(repository, "shared.txt"), "active edit\n");
  git(repository, ["add", "shared.txt"]);
  const beforeHead = git(repository, ["rev-parse", "HEAD"]);
  const beforeStatus = git(repository, ["status", "--short"]);

  const report = reconcile(repository);

  assert.equal(report.status, "LOCAL_WORKTREE_RETRYING");
  assert.equal(report.localWorktree.reason, "tracked-worktree-changes");
  assert.equal(git(repository, ["rev-parse", "HEAD"]), beforeHead);
  assert.equal(git(repository, ["status", "--short"]), beforeStatus);
  assert.equal(readFileSync(join(repository, "shared.txt"), "utf8"), "active edit\n");
});

test("fast-forwards around non-overlapping untracked files without deleting them", (context) => {
  const { repository, upstream } = createFixture(context);
  const remoteCommit = commitFile(upstream, "remote.txt", "remote\n", "remote release");
  git(upstream, ["push", "origin", "master"]);
  writeFileSync(join(repository, "notes.local"), "keep me\n");

  const report = reconcile(repository);

  assert.equal(report.status, "LOCAL_MAINLINE_SYNCED");
  assert.equal(git(repository, ["rev-parse", "HEAD"]), remoteCommit);
  assert.equal(readFileSync(join(repository, "notes.local"), "utf8"), "keep me\n");
  assert.equal(git(repository, ["status", "--short"]), "?? notes.local");
});

test("retry worker completes the local fast-forward after active edits settle", async (context) => {
  const { repository, upstream } = createFixture(context);
  const remoteCommit = commitFile(upstream, "remote.txt", "remote\n", "remote release");
  git(upstream, ["push", "origin", "master"]);
  writeFileSync(join(repository, "shared.txt"), "active edit\n");
  git(repository, ["add", "shared.txt"]);

  const report = reconcileReleaseMainline({
    maxWatchMs: 5_000,
    pollMs: 50,
    rootDir: repository,
    spawnWorker: true,
    validateCandidate: () => ({ command: "fixture-validation", typescript: false }),
  });
  assert.equal(report.status, "LOCAL_WORKTREE_RETRYING");
  assert.equal(Number.isInteger(report.worker.pid), true);

  const repeated = reconcileReleaseMainline({
    maxWatchMs: 5_000,
    pollMs: 50,
    rootDir: repository,
    spawnWorker: true,
  });
  assert.equal(repeated.worker.reused, true);
  assert.equal(repeated.worker.pid, report.worker.pid);

  git(repository, ["restore", "--staged", "shared.txt"]);
  git(repository, ["restore", "shared.txt"]);

  const commonGitDir = git(repository, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  const stateDir = join(commonGitDir, "nextclaw", "release-mainline");
  const workerPath = join(stateDir, "worker.json");
  const latestPath = join(stateDir, "latest.json");
  for (let attempt = 0; attempt < 60 && existsSync(workerPath); attempt += 1) {
    await wait(50);
  }

  assert.equal(existsSync(workerPath), false);
  assert.equal(git(repository, ["rev-parse", "HEAD"]), remoteCommit);
  assert.equal(JSON.parse(readFileSync(latestPath, "utf8")).status, "LOCAL_MAINLINE_SYNCED");
});

test("isolates semantic merge conflicts and leaves the active worktree and remote unchanged", (context) => {
  const { repository, upstream } = createFixture(context);
  const localCommit = commitFile(repository, "shared.txt", "local\n", "local conflict");
  const remoteCommit = commitFile(upstream, "shared.txt", "remote\n", "remote conflict");
  git(upstream, ["push", "origin", "master"]);

  const report = reconcile(repository);
  try {
    assert.equal(report.status, "MAINLINE_RECONCILIATION_RECOVERING");
    assert.deepEqual(report.conflictFiles, ["shared.txt"]);
    assert.equal(git(repository, ["rev-parse", "HEAD"]), localCommit);
    assert.equal(git(repository, ["rev-parse", "origin/master"]), remoteCommit);
    assert.equal(readFileSync(join(repository, "shared.txt"), "utf8"), "local\n");
    assert.equal(git(repository, ["status", "--short"]), "");
    assert.equal(existsSync(report.recoveryWorktree), true);
  } finally {
    if (report.recoveryWorktree && existsSync(report.recoveryWorktree)) {
      git(repository, ["worktree", "remove", "--force", report.recoveryWorktree]);
    }
    if (report.recoveryBranch) {
      git(repository, ["branch", "-D", report.recoveryBranch]);
    }
  }
});
