import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), "clean-generated-artifacts.mjs");
const generatedPaths = ["packages/nextclaw-service/build", "packages/nextclaw/ui-dist"];

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "nextclaw-clean-generated-"));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  writeFileSync(
    join(root, ".gitignore"),
    "/packages/nextclaw-service/build/\n/packages/nextclaw/ui-dist/\n",
  );
  for (const path of generatedPaths) {
    mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, path, "artifact.txt"), "generated\n");
  }
  return root;
}

function runScript(root, ...args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("check accepts ignored and untracked generated artifacts", () => {
  const root = createRepository();
  try {
    const result = runScript(root, "--check");
    assert.equal(result.status, 0, result.stderr);
    for (const path of generatedPaths) {
      assert.equal(existsSync(join(root, path, "artifact.txt")), true);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("clean removes ignored generated artifact directories", () => {
  const root = createRepository();
  try {
    const result = runScript(root);
    assert.equal(result.status, 0, result.stderr);
    for (const path of generatedPaths) {
      assert.equal(existsSync(join(root, path)), false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("check rejects generated artifacts that are tracked", () => {
  const root = createRepository();
  try {
    execFileSync("git", ["add", "-f", "packages/nextclaw/ui-dist/artifact.txt"], { cwd: root });
    const result = runScript(root, "--check");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /generated artifacts are still tracked/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
