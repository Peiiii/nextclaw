import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  closeStableGitReleaseState,
  ensureStableRemoteSync,
} from "./release-stable-git.mjs";

function git(rootDir, args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createLinkedReleaseFixture(context) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "stable-git-worktree-test-"));
  context.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const remote = join(fixtureRoot, "remote.git");
  const repository = join(fixtureRoot, "repository");
  const releaseWorktree = join(fixtureRoot, "release");
  execFileSync("git", ["init", "--bare", remote], { stdio: "ignore" });
  execFileSync("git", ["init", "--initial-branch", "master", repository], {
    stdio: "ignore",
  });
  git(repository, ["config", "user.name", "Stable Git Test"]);
  git(repository, ["config", "user.email", "stable-git@example.test"]);
  writeFileSync(join(repository, "release.txt"), "before\n");
  writeFileSync(join(repository, "wip.txt"), "before\n");
  git(repository, ["add", "."]);
  git(repository, ["commit", "-m", "initial"]);
  git(repository, ["remote", "add", "origin", remote]);
  git(repository, ["push", "-u", "origin", "master"]);
  git(repository, [
    "worktree",
    "add",
    "-b",
    "release/test",
    releaseWorktree,
    "master",
  ]);
  git(releaseWorktree, ["push", "-u", "origin", "release/test"]);
  return { releaseWorktree, repository };
}

test("prepared publish accepts a remotely advanced immutable release source", (context) => {
  const { releaseWorktree, repository } = createLinkedReleaseFixture(context);
  writeFileSync(join(repository, "remote.txt"), "newer\n");
  git(repository, ["add", "remote.txt"]);
  git(repository, ["commit", "-m", "advance target"]);
  git(repository, ["push", "origin", "master:release/test"]);

  assert.throws(
    () => ensureStableRemoteSync("release/test", { rootDir: releaseWorktree }),
    /remote-only=1, local-only=0/,
  );
  assert.doesNotThrow(() =>
    ensureStableRemoteSync("release/test", {
      allowRemoteAhead: true,
      rootDir: releaseWorktree,
    }),
  );

  writeFileSync(join(releaseWorktree, "local.txt"), "diverged\n");
  git(releaseWorktree, ["add", "local.txt"]);
  git(releaseWorktree, ["commit", "-m", "diverge release"]);
  assert.throws(
    () =>
      ensureStableRemoteSync("release/test", {
        allowRemoteAhead: true,
        rootDir: releaseWorktree,
      }),
    /remote-only=1, local-only=1/,
  );
});

test("atomic Git closure updates the release branch and local/remote target", (context) => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "stable-git-closure-test-"));
  context.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const remote = join(fixtureRoot, "remote.git");
  const repository = join(fixtureRoot, "repository");
  execFileSync("git", ["init", "--bare", remote], { stdio: "ignore" });
  execFileSync("git", ["init", "--initial-branch", "master", repository], {
    stdio: "ignore",
  });
  git(repository, ["config", "user.name", "Stable Git Test"]);
  git(repository, ["config", "user.email", "stable-git@example.test"]);
  writeFileSync(join(repository, "release.txt"), "before\n");
  git(repository, ["add", "."]);
  git(repository, ["commit", "-m", "initial"]);
  git(repository, ["remote", "add", "origin", remote]);
  git(repository, ["push", "-u", "origin", "master"]);
  git(repository, ["switch", "-c", "release/test"]);
  git(repository, ["push", "-u", "origin", "release/test"]);
  writeFileSync(join(repository, "release.txt"), "after\n");

  const summary = closeStableGitReleaseState({
    branch: "release/test",
    checkpoint: {
      packages: {
        nextclaw: { version: "1.2.3" },
        "@nextclaw/core": { version: "2.0.0" },
      },
    },
    mainlineOptions: { spawnWorker: false },
    rootDir: repository,
    runBranchClosure: () => {},
    targetBranch: "master",
  });

  assert.equal(git(repository, ["rev-parse", "master"]), summary.closureCommit);
  assert.equal(
    git(repository, ["rev-parse", "origin/master"]),
    summary.closureCommit,
  );
  assert.equal(
    git(repository, ["rev-parse", "origin/release/test"]),
    summary.closureCommit,
  );
  assert.equal(
    git(repository, ["rev-list", "-n", "1", "nextclaw@1.2.3"]),
    summary.releaseCommit,
  );
  assert.deepEqual(summary.releaseTags, [
    "@nextclaw/core@2.0.0",
    "nextclaw@1.2.3",
  ]);
  assert.equal(git(repository, ["status", "--short"]), "");

  const recoveredSummary = closeStableGitReleaseState({
    branch: "release/test",
    checkpoint: {
      packages: {
        nextclaw: { version: "1.2.3" },
        "@nextclaw/core": { version: "2.0.0" },
      },
    },
    mainlineOptions: { spawnWorker: false },
    rootDir: repository,
    runBranchClosure: () => {},
    targetBranch: "master",
  });
  assert.equal(recoveredSummary.releaseCommit, summary.releaseCommit);
  assert.equal(
    git(repository, ["rev-list", "-n", "1", "nextclaw@1.2.3"]),
    summary.releaseCommit,
  );
});

test("atomic Git closure keeps the default worktree on master and preserves unrelated WIP", (context) => {
  const { releaseWorktree, repository } = createLinkedReleaseFixture(context);
  writeFileSync(join(releaseWorktree, "release.txt"), "after\n");
  writeFileSync(join(repository, "wip.txt"), "local wip\n");

  const summary = closeStableGitReleaseState({
    branch: "release/test",
    checkpoint: { packages: { nextclaw: { version: "1.2.3" } } },
    mainlineOptions: { spawnWorker: false },
    rootDir: releaseWorktree,
    runBranchClosure: () => {},
    targetBranch: "master",
  });

  assert.equal(git(repository, ["branch", "--show-current"]), "master");
  assert.equal(
    summary.mainlineReconciliation.status,
    "LOCAL_WORKTREE_RETRYING",
  );
  assert.notEqual(git(repository, ["rev-parse", "HEAD"]), summary.closureCommit);
  assert.equal(
    git(releaseWorktree, ["rev-parse", "origin/master"]),
    summary.closureCommit,
  );
  assert.equal(
    readFileSync(join(repository, "wip.txt"), "utf8"),
    "local wip\n",
  );
  assert.equal(git(repository, ["status", "--short"]), "M wip.txt");
  assert.equal(git(releaseWorktree, ["status", "--short"]), "");

  writeFileSync(join(repository, "release.txt"), "local overlap\n");
  writeFileSync(join(releaseWorktree, "release.txt"), "next release\n");
  const nextSummary = closeStableGitReleaseState({
    branch: "release/test",
    checkpoint: { packages: { nextclaw: { version: "1.2.4" } } },
    mainlineOptions: { spawnWorker: false },
    rootDir: releaseWorktree,
    runBranchClosure: () => {},
    targetBranch: "master",
  });
  assert.equal(
    nextSummary.mainlineReconciliation.status,
    "LOCAL_WORKTREE_RETRYING",
  );
  assert.equal(git(repository, ["branch", "--show-current"]), "master");
  assert.notEqual(git(repository, ["rev-parse", "HEAD"]), nextSummary.closureCommit);
  assert.equal(
    git(releaseWorktree, ["rev-parse", "origin/master"]),
    nextSummary.closureCommit,
  );
  assert.equal(
    readFileSync(join(repository, "release.txt"), "utf8"),
    "local overlap\n",
  );
});
