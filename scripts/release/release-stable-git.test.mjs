import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { closeStableGitReleaseState } from "./release-stable-git.mjs";

function git(rootDir, args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

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
