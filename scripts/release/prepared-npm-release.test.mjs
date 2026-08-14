import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
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
  createPreparedNpmRelease,
  mapWithConcurrency,
  publishPreparedNpmRelease,
  validatePreparedNpmRelease,
} from "./prepared-npm-release.mjs";

function createRecord() {
  return {
    batchDirectory: "/tmp/prepared-release",
    manifest: {
      registry: "https://registry.example.test/",
      targetVersion: "1.2.3",
      packages: [
        {
          name: "@nextclaw/core",
          version: "2.0.0",
          tarballPath: "packages/core.tgz",
          sha512: "core-integrity",
        },
        {
          name: "nextclaw",
          version: "1.2.3",
          tarballPath: "packages/nextclaw.tgz",
          sha512: "nextclaw-integrity",
        },
      ],
    },
  };
}

function publishedIdentity(record, spec, latest = null) {
  const entry = record.manifest.packages.find(
    (candidate) => `${candidate.name}@${candidate.version}` === spec,
  );
  if (!entry) throw new Error(`Unknown fixture package: ${spec}`);
  return JSON.stringify({
    version: entry.version,
    "dist.integrity": `sha512-${entry.sha512}`,
    "dist-tags.latest": latest ?? entry.version,
  });
}

test("mapWithConcurrency keeps result order and obeys its limit", async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency(
    [1, 2, 3, 4, 5],
    2,
    async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value * 2;
    },
  );
  assert.deepEqual(results, [2, 4, 6, 8, 10]);
  assert.equal(peak, 2);
});

test("mapWithConcurrency waits for every started operation before reporting failures", async () => {
  const completed = [];
  await assert.rejects(
    mapWithConcurrency([1, 2, 3], 3, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, value === 1 ? 1 : 10));
      completed.push(value);
      if (value === 1) throw new Error("first failed");
      return value;
    }),
    /1 of 3 concurrent operation/,
  );
  assert.deepEqual(completed.sort(), [1, 2, 3]);
});

test("prepared publish uploads only missing versions and verifies latest", async () => {
  const calls = [];
  const visible = new Set(["@nextclaw/core@2.0.0"]);
  const record = createRecord();
  const runCommand = async (args) => {
    calls.push(args);
    if (args[0] === "publish") {
      visible.add("nextclaw@1.2.3");
      return { stdout: "{}" };
    }
    const spec = args[1];
    if (visible.has(spec)) return { stdout: publishedIdentity(record, spec) };
    throw new Error("E404");
  };

  const result = await publishPreparedNpmRelease({
    record,
    runCommand,
    verifyAttempts: 1,
    verifyDelayMs: 1,
  });

  assert.equal(result.packageCount, 2);
  assert.equal(result.publishedCount, 1);
  assert.equal(result.reusedCount, 1);
  const publishCalls = calls.filter((args) => args[0] === "publish");
  assert.equal(publishCalls.length, 1);
  assert.match(publishCalls[0][1], /nextclaw\.tgz$/);
});

test("prepared publish never retries an already visible package after partial recovery", async () => {
  const record = createRecord();
  const publishedTarballs = [];
  const visible = new Set(
    record.manifest.packages.map((entry) => `${entry.name}@${entry.version}`),
  );
  const runCommand = async (args) => {
    if (args[0] === "publish") {
      publishedTarballs.push(args[1]);
      return { stdout: "{}" };
    }
    if (visible.has(args[1])) {
      return {
        stdout: publishedIdentity(record, args[1]),
      };
    }
    throw new Error("E404");
  };

  const result = await publishPreparedNpmRelease({
    record,
    runCommand,
    verifyAttempts: 1,
  });
  assert.equal(result.publishedCount, 0);
  assert.deepEqual(publishedTarballs, []);
});

test("prepared publish refuses a wrong latest dist-tag", async () => {
  const record = createRecord();
  const runCommand = async (args) => {
    return {
      stdout: publishedIdentity(
        record,
        args[1],
        args[1] === "nextclaw@1.2.3" ? "1.2.2" : null,
      ),
    };
  };
  await assert.rejects(
    publishPreparedNpmRelease({ record, runCommand, verifyAttempts: 1 }),
    /nextclaw@latest is 1\.2\.2/,
  );
});

test("prepared publish refuses an immutable integrity conflict", async () => {
  const record = createRecord();
  const runCommand = async (args) => {
    const identity = JSON.parse(publishedIdentity(record, args[1]));
    if (args[1] === "@nextclaw/core@2.0.0") {
      identity["dist.integrity"] = "sha512-different";
    }
    return { stdout: JSON.stringify(identity) };
  };
  await assert.rejects(
    publishPreparedNpmRelease({ record, runCommand, verifyAttempts: 1 }),
    /registry integrity mismatch/,
  );
});

test("prepared manifest binds immutable tarballs to the exact release tree", (context) => {
  const rootDir = mkdtempSync(join(tmpdir(), "prepared-npm-release-test-"));
  context.after(() => rmSync(rootDir, { force: true, recursive: true }));
  execFileSync("git", ["init"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Prepared Release Test"], {
    cwd: rootDir,
  });
  execFileSync("git", ["config", "user.email", "prepared@example.test"], {
    cwd: rootDir,
  });
  mkdirSync(join(rootDir, "packages/nextclaw"), { recursive: true });
  writeFileSync(
    join(rootDir, "packages/nextclaw/package.json"),
    `${JSON.stringify({ name: "nextclaw", version: "1.2.3", files: ["index.js"] }, null, 2)}\n`,
  );
  writeFileSync(
    join(rootDir, "packages/nextclaw/index.js"),
    "console.log('prepared');\n",
  );
  execFileSync("git", ["add", "."], { cwd: rootDir });
  execFileSync("git", ["commit", "-m", "fixture"], {
    cwd: rootDir,
    stdio: "ignore",
  });
  const checkpoint = {
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

  const record = createPreparedNpmRelease({
    branch: "release/test",
    checkpoint,
    previousVersion: "1.2.2",
    registry: "https://registry.example.test/",
    rootDir,
    targetBranch: "master",
  });
  assert.doesNotThrow(() =>
    validatePreparedNpmRelease({
      branch: "release/test",
      record,
      registry: "https://registry.example.test/",
      rootDir,
      targetBranch: "master",
      targetVersion: "1.2.3",
    }),
  );
  const persisted = JSON.parse(readFileSync(record.manifestPath, "utf8"));
  assert.equal(persisted.packages[0].name, "nextclaw");
  assert.equal(persisted.proof.tarballManifestAudit, "passed");

  writeFileSync(
    join(rootDir, "packages/nextclaw/index.js"),
    "console.log('changed');\n",
  );
  assert.throws(
    () => validatePreparedNpmRelease({ record, rootDir }),
    /release tree fingerprint changed/,
  );
});
