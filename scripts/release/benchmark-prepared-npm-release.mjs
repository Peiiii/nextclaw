#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join } from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";

import {
  mapWithConcurrency,
  publishPreparedNpmRelease,
} from "./prepared-npm-release.mjs";

const execFileAsync = promisify(execFile);
const ROOT_DIR = process.cwd();
const PUBLIC_REGISTRY = "https://registry.npmjs.org/";

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? ROOT_DIR,
    encoding: "utf8",
    env: process.env,
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    maxBuffer: 100 * 1024 * 1024,
  });
}

async function runAsync(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: options.cwd ?? ROOT_DIR,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 100 * 1024 * 1024,
  });
}

function parsePackFilename(output) {
  const result = JSON.parse(output);
  const entry = Array.isArray(result) ? result[0] : result;
  assert.equal(
    typeof entry?.filename,
    "string",
    "npm pack must return a filename",
  );
  return entry.filename;
}

function sha512File(filePath) {
  return createHash("sha512").update(readFileSync(filePath)).digest("base64");
}

async function downloadTarball(spec, directory) {
  const { stdout } = await runAsync("npm", [
    "pack",
    spec,
    "--pack-destination",
    directory,
    "--ignore-scripts",
    "--json",
    "--registry",
    PUBLIC_REGISTRY,
  ]);
  const filename = parsePackFilename(stdout);
  return isAbsolute(filename) ? filename : join(directory, filename);
}

async function readPackageMetadata(spec) {
  const { stdout } = await runAsync("npm", [
    "view",
    spec,
    "name",
    "version",
    "dependencies",
    "optionalDependencies",
    "--json",
    "--registry",
    PUBLIC_REGISTRY,
  ]);
  return JSON.parse(stdout);
}

function normalizeMetadata(raw) {
  if (Array.isArray(raw)) return raw.at(-1);
  return raw;
}

async function resolveInternalDependencyClosure(targetSpecs) {
  const targetSet = new Set(targetSpecs);
  const visited = new Set();
  const seedSpecs = new Set();
  let pending = [...targetSpecs];
  while (pending.length > 0) {
    const level = [...new Set(pending)].filter((spec) => !visited.has(spec));
    pending = [];
    level.forEach((spec) => visited.add(spec));
    const metadataEntries = await mapWithConcurrency(
      level,
      12,
      readPackageMetadata,
    );
    const unresolved = [];
    for (const metadataEntry of metadataEntries) {
      const metadata = normalizeMetadata(metadataEntry);
      const dependencies = {
        ...(metadata.dependencies ?? {}),
        ...(metadata.optionalDependencies ?? {}),
      };
      for (const [name, range] of Object.entries(dependencies)) {
        if (!name.startsWith("@nextclaw/")) continue;
        if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(range)) {
          unresolved.push({ name, range, version: range });
        } else {
          unresolved.push({ name, range, version: null });
        }
      }
    }
    await mapWithConcurrency(
      unresolved.filter((entry) => !entry.version),
      12,
      async (entry) => {
        const versionResult = await runAsync("npm", [
          "view",
          `${entry.name}@${entry.range}`,
          "version",
          "--json",
          "--registry",
          PUBLIC_REGISTRY,
        ]);
        const parsedVersion = JSON.parse(versionResult.stdout);
        entry.version = Array.isArray(parsedVersion)
          ? parsedVersion.at(-1)
          : parsedVersion;
      },
    );
    for (const entry of unresolved) {
      const dependencySpec = `${entry.name}@${entry.version}`;
      if (!targetSet.has(dependencySpec)) seedSpecs.add(dependencySpec);
      if (!visited.has(dependencySpec)) pending.push(dependencySpec);
    }
  }
  return [...seedSpecs].sort();
}

async function publishSeedPackages(seedSpecs, registry, directory) {
  const missingSeedSpecs = (
    await mapWithConcurrency(seedSpecs, 12, async (spec) => {
      try {
        await runAsync("npm", [
          "view",
          spec,
          "version",
          "--json",
          "--registry",
          registry,
        ]);
        return null;
      } catch {
        return spec;
      }
    })
  ).filter(Boolean);
  const tarballs = await mapWithConcurrency(missingSeedSpecs, 8, (spec) =>
    downloadTarball(spec, directory),
  );
  await mapWithConcurrency(tarballs, 8, (tarballPath) =>
    runAsync("npm", [
      "publish",
      tarballPath,
      "--access",
      "public",
      "--tag",
      "latest",
      "--ignore-scripts",
      "--json",
      "--registry",
      registry,
    ]),
  );
}

function readTargetSpecs(sourceTag) {
  const commit = run("git", ["rev-list", "-n", "1", sourceTag]).trim();
  return run("git", ["tag", "--points-at", commit])
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry === sourceTag || entry.startsWith("@nextclaw/"))
    .sort();
}

async function buildPreparedRecord(targetSpecs, registry, rootDirectory) {
  const packageDirectory = join(rootDirectory, "packages");
  mkdirSync(packageDirectory, { recursive: true });
  const tarballPaths = await mapWithConcurrency(targetSpecs, 8, (spec) =>
    downloadTarball(spec, packageDirectory),
  );
  const packages = targetSpecs.map((spec, index) => {
    const split = spec.lastIndexOf("@");
    const tarballPath = tarballPaths[index];
    return {
      name: spec.slice(0, split),
      version: spec.slice(split + 1),
      tarballPath: `packages/${basename(tarballPath)}`,
      size: statSync(tarballPath).size,
      sha512: sha512File(tarballPath),
    };
  });
  const targetVersion = packages.find(
    (entry) => entry.name === "nextclaw",
  )?.version;
  assert.ok(targetVersion, "benchmark batch must contain nextclaw");
  return {
    batchDirectory: rootDirectory,
    manifest: {
      registry,
      targetVersion,
      packages,
    },
  };
}

async function verifyRegistryPayload(record, rootDirectory) {
  const cache = join(rootDirectory, "registry-payload-cache");
  const downloadDirectory = join(rootDirectory, "registry-payload");
  mkdirSync(downloadDirectory, { recursive: true });
  const { stdout } = await runAsync("npm", [
    "pack",
    `nextclaw@${record.manifest.targetVersion}`,
    "--pack-destination",
    downloadDirectory,
    "--cache",
    cache,
    "--ignore-scripts",
    "--json",
    "--no-audit",
    "--no-fund",
    "--prefer-online",
    "--registry",
    PUBLIC_REGISTRY,
  ]);
  const filename = parsePackFilename(stdout);
  const tarballPath = isAbsolute(filename)
    ? filename
    : join(downloadDirectory, filename);
  run("tar", ["-xzf", tarballPath, "-C", downloadDirectory]);
  const packageDirectory = join(downloadDirectory, "package");
  const packageJson = JSON.parse(
    readFileSync(join(packageDirectory, "package.json"), "utf8"),
  );
  assert.equal(packageJson.version, record.manifest.targetVersion);
  for (const relativePath of [
    "dist/cli/app/index.js",
    "dist/cli/launcher/index.js",
    "resources/update-bundle-public.pem",
    "ui-dist/index.html",
  ]) {
    assert.ok(
      existsSync(join(packageDirectory, relativePath)),
      `installed benchmark package is missing ${relativePath}`,
    );
  }
}

async function verifyGitClosure(rootDirectory, tagCount) {
  const remoteDirectory = join(rootDirectory, "remote.git");
  const repositoryDirectory = join(rootDirectory, "repository");
  run("git", ["init", "--bare", remoteDirectory]);
  run("git", ["init", "-b", "master", repositoryDirectory]);
  run("git", ["config", "user.name", "Release Benchmark"], {
    cwd: repositoryDirectory,
  });
  run("git", ["config", "user.email", "release-benchmark@example.test"], {
    cwd: repositoryDirectory,
  });
  writeFileSync(join(repositoryDirectory, "release.txt"), "base\n");
  run("git", ["add", "release.txt"], { cwd: repositoryDirectory });
  run("git", ["commit", "-m", "base"], { cwd: repositoryDirectory });
  run("git", ["remote", "add", "origin", remoteDirectory], {
    cwd: repositoryDirectory,
  });
  run("git", ["push", "origin", "master"], { cwd: repositoryDirectory });
  run("git", ["switch", "-c", "release/benchmark"], {
    cwd: repositoryDirectory,
  });
  writeFileSync(join(repositoryDirectory, "release.txt"), "release\n");
  run("git", ["commit", "-am", "release"], { cwd: repositoryDirectory });
  const tags = Array.from(
    { length: tagCount },
    (_, index) => `benchmark-package-${index}@1.0.0`,
  );
  for (const tag of tags)
    run("git", ["tag", tag], { cwd: repositoryDirectory });
  run(
    "git",
    [
      "push",
      "--atomic",
      "origin",
      "HEAD:release/benchmark",
      "HEAD:master",
      ...tags.map((tag) => `refs/tags/${tag}`),
    ],
    { cwd: repositoryDirectory },
  );
  run("git", ["branch", "-f", "master", "HEAD"], { cwd: repositoryDirectory });
  run("git", ["fetch", "origin", "master"], { cwd: repositoryDirectory });
  assert.equal(
    run("git", ["rev-parse", "master"], { cwd: repositoryDirectory }).trim(),
    run("git", ["rev-parse", "origin/master"], {
      cwd: repositoryDirectory,
    }).trim(),
  );
}

async function main() {
  const registry = readArg("--registry");
  const sourceTag = readArg("--source-tag", "nextclaw@0.34.0");
  const maxSeconds = Number(readArg("--max-seconds", "60"));
  assert.match(registry ?? "", /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/$/);
  const rootDirectory = mkdtempSync(
    join(tmpdir(), "nextclaw-prepared-publish-benchmark-"),
  );
  try {
    const targetSpecs = readTargetSpecs(sourceTag);
    assert.equal(
      targetSpecs.length,
      22,
      "expected the observed 22-package stable batch",
    );
    const record = await buildPreparedRecord(
      targetSpecs,
      registry,
      rootDirectory,
    );
    const seedSpecs = await resolveInternalDependencyClosure(targetSpecs);
    const seedDirectory = join(rootDirectory, "seed-packages");
    mkdirSync(seedDirectory, { recursive: true });
    await publishSeedPackages(seedSpecs, registry, seedDirectory);

    const startedAt = performance.now();
    const publishResult = await publishPreparedNpmRelease({
      publishConcurrency: 12,
      record,
      registry,
      verifyConcurrency: 8,
      verifyDelayMs: 100,
    });
    await Promise.all([
      verifyRegistryPayload(record, rootDirectory),
      verifyGitClosure(rootDirectory, targetSpecs.length),
    ]);
    const durationMs = performance.now() - startedAt;
    assert.ok(
      durationMs < maxSeconds * 1000,
      `prepared NPM benchmark exceeded ${maxSeconds}s: ${(durationMs / 1000).toFixed(2)}s`,
    );
    console.log(
      JSON.stringify(
        {
          status: "NPM_READY_BENCHMARK",
          sourceTag,
          packageCount: targetSpecs.length,
          seedPackageCount: seedSpecs.length,
          publishedCount: publishResult.publishedCount,
          registryVerificationAttempts: publishResult.attemptsUsed,
          packageTimingsSeconds: Object.fromEntries(
            Object.entries(publishResult.timings).map(([key, value]) => [
              key.replace(/Ms$/, ""),
              Number((value / 1000).toFixed(3)),
            ]),
          ),
          registryPayload: "passed",
          gitClosure: "passed",
          durationSeconds: Number((durationMs / 1000).toFixed(3)),
          maxSeconds,
        },
        null,
        2,
      ),
    );
  } finally {
    rmSync(rootDirectory, { force: true, recursive: true });
  }
}

await main();
