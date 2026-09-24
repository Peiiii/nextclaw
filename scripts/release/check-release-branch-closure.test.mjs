import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const checker = fileURLToPath(new URL("./check-release-branch-closure.mjs", import.meta.url));

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function commit(cwd, file, content) {
  mkdirSync(join(cwd, "apps"), { recursive: true });
  writeFileSync(join(cwd, "apps", file), content);
  git(cwd, "add", ".");
  git(cwd, "commit", "-qm", file);
  return git(cwd, "rev-parse", "HEAD");
}

test("release ancestor remains closed after later target changes", () => {
  const cwd = mkdtempSync(join(tmpdir(), "nextclaw-branch-closure-"));
  try {
    git(cwd, "init", "-q");
    git(cwd, "config", "user.email", "test@example.com");
    git(cwd, "config", "user.name", "Test");
    commit(cwd, "base.txt", "base");
    const release = commit(cwd, "release.txt", "released");
    const target = commit(cwd, "later.txt", "later");

    const closed = spawnSync(process.execPath, [checker, "--target", target, "--release", release], { cwd, encoding: "utf8" });
    assert.equal(closed.status, 0, closed.stderr);
    assert.match(closed.stdout, /post-release target changes:/);
    assert.match(closed.stdout, /branch closure check passed/);

    git(cwd, "checkout", "-q", release);
    const divergent = commit(cwd, "divergent.txt", "divergent");
    const open = spawnSync(process.execPath, [checker, "--target", target, "--release", divergent], { cwd, encoding: "utf8" });
    assert.equal(open.status, 1);
    assert.match(open.stderr, /branch closure check failed/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
