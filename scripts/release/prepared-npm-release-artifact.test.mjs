import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  exportPreparedNpmReleaseArtifact,
  importPreparedNpmReleaseArtifact,
  ensurePreparedNpmReleaseArtifact,
  selectPreparedNpmWorkflowRun,
} from "./prepared-npm-release-artifact.mjs";
import { createPreparedNpmRelease } from "./prepared-npm-release.mjs";

function git(rootDir, args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createSourceRepository(parentDirectory) {
  const rootDir = join(parentDirectory, "source");
  mkdirSync(join(rootDir, "packages/nextclaw"), { recursive: true });
  writeFileSync(
    join(rootDir, "packages/nextclaw/package.json"),
    `${JSON.stringify({ name: "nextclaw", version: "1.2.2", files: ["index.js"] }, null, 2)}\n`,
  );
  writeFileSync(
    join(rootDir, "packages/nextclaw/index.js"),
    "console.log('old');\n",
  );
  git(rootDir, ["init", "--initial-branch", "master"]);
  git(rootDir, ["config", "user.name", "Prepared Artifact Test"]);
  git(rootDir, ["config", "user.email", "prepared-artifact@example.test"]);
  git(rootDir, ["add", "."]);
  git(rootDir, ["commit", "-m", "fixture"]);
  return rootDir;
}

function createCheckpoint() {
  return {
    packages: {
      nextclaw: {
        packageDir: "packages/nextclaw",
        version: "1.2.3",
        steps: {
          build: { status: "passed" },
          tsc: { status: "passed" },
          lint: { status: "passed" },
        },
      },
    },
    validationSupport: {},
  };
}

test("exports and imports an exact prepared release tree", (context) => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "prepared-npm-artifact-test-"),
  );
  context.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const sourceRoot = createSourceRepository(fixtureRoot);
  const sourceCommit = git(sourceRoot, ["rev-parse", "HEAD"]);
  const packageFile = join(sourceRoot, "packages/nextclaw/package.json");
  writeFileSync(
    packageFile,
    `${JSON.stringify({ name: "nextclaw", version: "1.2.3", files: ["index.js"] }, null, 2)}\n`,
  );
  writeFileSync(
    join(sourceRoot, "packages/nextclaw/index.js"),
    "console.log('new');\n",
  );
  writeFileSync(
    join(sourceRoot, "release-note.txt"),
    "untracked release file\n",
  );
  const record = createPreparedNpmRelease({
    branch: "master",
    checkpoint: createCheckpoint(),
    previousVersion: "1.2.2",
    registry: "https://registry.example.test/",
    rootDir: sourceRoot,
    targetBranch: "master",
  });
  const artifactDirectory = join(fixtureRoot, "artifact");
  exportPreparedNpmReleaseArtifact({
    outputDirectory: artifactDirectory,
    record,
    rootDir: sourceRoot,
  });

  const importRoot = join(fixtureRoot, "import");
  execFileSync("git", ["clone", "--no-local", sourceRoot, importRoot], {
    stdio: "ignore",
  });
  assert.equal(git(importRoot, ["rev-parse", "HEAD"]), sourceCommit);
  const importedRecord = importPreparedNpmReleaseArtifact({
    artifactDirectory,
    registry: "https://registry.example.test/",
    rootDir: importRoot,
    targetBranch: "master",
  });

  assert.equal(
    JSON.parse(readFileSync(join(importRoot, "packages/nextclaw/package.json")))
      .version,
    "1.2.3",
  );
  assert.equal(
    readFileSync(join(importRoot, "release-note.txt"), "utf8"),
    "untracked release file\n",
  );
  assert.equal(importedRecord.manifest.sourceCommit, sourceCommit);
  assert.ok(existsSync(join(importedRecord.batchDirectory, "packages")));
});

test("artifact import refuses a dirty source tree before applying its patch", (context) => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "prepared-npm-artifact-dirty-test-"),
  );
  context.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const sourceRoot = createSourceRepository(fixtureRoot);
  writeFileSync(
    join(sourceRoot, "packages/nextclaw/index.js"),
    "console.log('new');\n",
  );
  const packageFile = join(sourceRoot, "packages/nextclaw/package.json");
  const packageJson = JSON.parse(readFileSync(packageFile, "utf8"));
  packageJson.version = "1.2.3";
  writeFileSync(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
  const record = createPreparedNpmRelease({
    branch: "master",
    checkpoint: createCheckpoint(),
    previousVersion: "1.2.2",
    registry: "https://registry.example.test/",
    rootDir: sourceRoot,
    targetBranch: "master",
  });
  const artifactDirectory = join(fixtureRoot, "artifact");
  exportPreparedNpmReleaseArtifact({
    outputDirectory: artifactDirectory,
    record,
    rootDir: sourceRoot,
  });

  const importRoot = join(fixtureRoot, "import");
  execFileSync("git", ["clone", "--no-local", sourceRoot, importRoot], {
    stdio: "ignore",
  });
  writeFileSync(join(importRoot, "local.txt"), "dirty\n");
  assert.throws(
    () =>
      importPreparedNpmReleaseArtifact({
        artifactDirectory,
        rootDir: importRoot,
      }),
    /requires a clean source worktree/,
  );
  assert.equal(
    JSON.parse(readFileSync(join(importRoot, "packages/nextclaw/package.json")))
      .version,
    "1.2.2",
  );
});

test("selects only a successful exact-commit preparation run", () => {
  const runs = [
    {
      databaseId: 1,
      headSha: "other",
      status: "completed",
      conclusion: "success",
    },
    {
      databaseId: 2,
      headSha: "wanted",
      status: "completed",
      conclusion: "failure",
    },
    {
      databaseId: 3,
      headSha: "wanted",
      status: "completed",
      conclusion: "success",
    },
  ];
  assert.equal(selectPreparedNpmWorkflowRun(runs, "wanted")?.databaseId, 3);
  assert.equal(selectPreparedNpmWorkflowRun(runs, "missing"), null);
});

test("downloads the exact successful workflow artifact before importing", (context) => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "prepared-npm-download-test-"),
  );
  context.after(() => rmSync(fixtureRoot, { force: true, recursive: true }));
  const sourceRoot = createSourceRepository(fixtureRoot);
  const packageFile = join(sourceRoot, "packages/nextclaw/package.json");
  const packageJson = JSON.parse(readFileSync(packageFile, "utf8"));
  packageJson.version = "1.2.3";
  writeFileSync(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
  const record = createPreparedNpmRelease({
    branch: "master",
    checkpoint: createCheckpoint(),
    previousVersion: "1.2.2",
    registry: "https://registry.example.test/",
    rootDir: sourceRoot,
    targetBranch: "master",
  });
  const artifactDirectory = join(fixtureRoot, "artifact");
  exportPreparedNpmReleaseArtifact({
    outputDirectory: artifactDirectory,
    record,
    rootDir: sourceRoot,
  });

  const importRoot = join(fixtureRoot, "import");
  execFileSync("git", ["clone", "--no-local", sourceRoot, importRoot], {
    stdio: "ignore",
  });
  const sourceCommit = git(importRoot, ["rev-parse", "HEAD"]);
  const calls = [];
  const downloaded = ensurePreparedNpmReleaseArtifact({
    registry: "https://registry.example.test/",
    rootDir: importRoot,
    runCommand: (command, args) => {
      calls.push([command, ...args]);
      if (args[1] === "list") {
        return JSON.stringify([
          {
            conclusion: "success",
            databaseId: 42,
            headSha: sourceCommit,
            status: "completed",
          },
        ]);
      }
      const downloadDirectory = args[args.indexOf("--dir") + 1];
      cpSync(artifactDirectory, downloadDirectory, {
        recursive: true,
        force: true,
      });
      return "";
    },
    targetBranch: "master",
  });

  assert.equal(downloaded.manifest.sourceCommit, sourceCommit);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].slice(0, 3), ["gh", "run", "list"]);
  assert.deepEqual(calls[1].slice(0, 3), ["gh", "run", "download"]);
  assert.equal(
    JSON.parse(readFileSync(join(importRoot, "packages/nextclaw/package.json")))
      .version,
    "1.2.3",
  );
});
