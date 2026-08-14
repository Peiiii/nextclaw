import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
const ROOT_DIR = process.cwd();
const SCHEMA_VERSION = 1;

function sha512File(filePath) {
  return createHash("sha512").update(readFileSync(filePath)).digest("base64");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd ?? ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function resolveGitCommonDir(rootDir = ROOT_DIR) {
  return git(["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: rootDir,
  });
}

function listUntrackedFiles(rootDir) {
  return git(["ls-files", "--others", "--exclude-standard", "-z"], {
    cwd: rootDir,
  })
    .split("\0")
    .filter(Boolean)
    .sort();
}

export function computeReleaseTreeFingerprint(rootDir = ROOT_DIR) {
  const hash = createHash("sha256");
  hash.update(git(["rev-parse", "HEAD"], { cwd: rootDir }));
  hash.update("\0");
  hash.update(
    execFileSync(
      "git",
      ["diff", "--binary", "--no-ext-diff", "HEAD", "--", "."],
      {
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 100 * 1024 * 1024,
      },
    ),
  );
  for (const filePath of listUntrackedFiles(rootDir)) {
    hash.update("\0");
    hash.update(filePath);
    hash.update("\0");
    hash.update(readFileSync(resolve(rootDir, filePath)));
  }
  return hash.digest("hex");
}

function validateCheckpointSteps(checkpoint) {
  const issues = [];
  for (const [packageName, packageState] of Object.entries(
    checkpoint?.packages ?? {},
  )) {
    for (const stepName of ["build", "tsc", "lint"]) {
      if (packageState?.steps?.[stepName]?.status !== "passed") {
        issues.push(`${packageName}: ${stepName} has not passed`);
      }
    }
  }
  for (const [packageName, packageState] of Object.entries(
    checkpoint?.validationSupport ?? {},
  )) {
    if (packageState?.steps?.build?.status !== "passed") {
      issues.push(`${packageName}: support build has not passed`);
    }
  }
  if (issues.length > 0) {
    throw new Error(
      `Cannot prepare an unvalidated NPM batch:\n${issues.join("\n")}`,
    );
  }
}

function parsePackOutput(output) {
  const parsed = JSON.parse(output);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!entry || typeof entry.filename !== "string") {
    throw new Error("pnpm pack did not return a tarball filename.");
  }
  return entry;
}

function readTarballPackageJson(tarballPath) {
  const output = execFileSync(
    "tar",
    ["-xOf", tarballPath, "package/package.json"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return JSON.parse(output);
}

function collectWorkspaceProtocolLeaks(packageJson) {
  const leaks = [];
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    for (const [name, version] of Object.entries(packageJson[field] ?? {})) {
      if (typeof version === "string" && version.startsWith("workspace:")) {
        leaks.push(`${field}.${name}=${version}`);
      }
    }
  }
  return leaks;
}

function packReleasePackage(entry, packageDirectory, rootDir) {
  const output = execFileSync(
    "pnpm",
    [
      "-C",
      entry.packageDir,
      "pack",
      "--pack-destination",
      packageDirectory,
      "--json",
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        npm_config_ignore_scripts: "true",
      },
      maxBuffer: 100 * 1024 * 1024,
    },
  );
  const packResult = parsePackOutput(output);
  const tarballPath = resolve(rootDir, packResult.filename);
  const packageJson = readTarballPackageJson(tarballPath);
  if (
    packageJson.name !== entry.name ||
    packageJson.version !== entry.version
  ) {
    throw new Error(
      `Packed identity mismatch for ${entry.name}: ${packageJson.name}@${packageJson.version}`,
    );
  }
  const workspaceLeaks = collectWorkspaceProtocolLeaks(packageJson);
  if (workspaceLeaks.length > 0) {
    throw new Error(
      `Packed manifest for ${entry.name}@${entry.version} contains workspace protocols: ${workspaceLeaks.join(", ")}`,
    );
  }
  return {
    name: entry.name,
    version: entry.version,
    packageDir: entry.packageDir,
    tarballPath: relative(dirname(packageDirectory), tarballPath).replaceAll(
      "\\",
      "/",
    ),
    sha512: sha512File(tarballPath),
    size: statSync(tarballPath).size,
  };
}

function writeJsonAtomically(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(temporaryPath, filePath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

export function resolvePreparedNpmReleaseRoot(rootDir = ROOT_DIR) {
  return join(resolveGitCommonDir(rootDir), "nextclaw-release", "prepared");
}

function resolveLatestPointerPath(rootDir = ROOT_DIR) {
  return join(resolvePreparedNpmReleaseRoot(rootDir), "latest.json");
}

export function writePreparedNpmReleasePointer(
  manifestPath,
  rootDir = ROOT_DIR,
) {
  const preparedRoot = resolvePreparedNpmReleaseRoot(rootDir);
  const relativeManifestPath = relative(preparedRoot, manifestPath).replaceAll(
    "\\",
    "/",
  );
  const resolvedManifestPath = resolve(preparedRoot, relativeManifestPath);
  if (
    !relativeManifestPath ||
    relativeManifestPath.startsWith("../") ||
    resolvedManifestPath !== resolve(manifestPath)
  ) {
    throw new Error(
      `Prepared NPM manifest is outside the prepared root: ${manifestPath}`,
    );
  }
  writeJsonAtomically(resolveLatestPointerPath(rootDir), {
    schemaVersion: SCHEMA_VERSION,
    manifestPath: relativeManifestPath,
  });
}

function buildCheckpointPackages(checkpoint) {
  return Object.entries(checkpoint?.packages ?? {})
    .map(([name, packageState]) => ({
      name,
      version: packageState?.version,
      packageDir: packageState?.packageDir,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function createPreparedNpmRelease(options) {
  const {
    branch,
    checkpoint,
    previousVersion,
    registry,
    rootDir = ROOT_DIR,
    targetBranch = "master",
  } = options;
  validateCheckpointSteps(checkpoint);
  const packages = buildCheckpointPackages(checkpoint);
  if (packages.length === 0) {
    throw new Error("Cannot prepare an empty NPM release batch.");
  }
  for (const entry of packages) {
    if (!entry.version || !entry.packageDir) {
      throw new Error(`Incomplete checkpoint package identity: ${entry.name}`);
    }
  }
  const nextclawPackage = packages.find((entry) => entry.name === "nextclaw");
  if (!nextclawPackage) {
    throw new Error(
      "Stable NPM preparation requires nextclaw in the release batch.",
    );
  }

  const treeFingerprint = computeReleaseTreeFingerprint(rootDir);
  const preparedRoot = resolvePreparedNpmReleaseRoot(rootDir);
  mkdirSync(preparedRoot, { recursive: true });
  const temporaryBatchDirectory = mkdtempSync(
    join(preparedRoot, ".preparing-"),
  );
  const packageDirectory = join(temporaryBatchDirectory, "packages");
  mkdirSync(packageDirectory, { recursive: true });
  const packedPackages = packages.map((entry) =>
    packReleasePackage(entry, packageDirectory, rootDir),
  );
  const batchIdentity = sha256(
    [
      treeFingerprint,
      registry,
      ...packedPackages.map(
        (entry) => `${entry.name}@${entry.version}:${entry.sha512}`,
      ),
    ].join("\n"),
  ).slice(0, 20);
  const batchDirectoryName = `${nextclawPackage.version}-${batchIdentity}`;
  const batchDirectory = join(preparedRoot, batchDirectoryName);
  if (existsSync(batchDirectory)) {
    throw new Error(`Prepared NPM batch already exists: ${batchDirectory}`);
  }
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    batchId: batchIdentity,
    sourceCommit: git(["rev-parse", "HEAD"], { cwd: rootDir }),
    treeFingerprint,
    registry,
    branch,
    targetBranch,
    targetVersion: nextclawPackage.version,
    previousVersion: previousVersion ?? null,
    validationPackageCount:
      packages.length + Object.keys(checkpoint?.validationSupport ?? {}).length,
    validationSupportPackageCount: Object.keys(
      checkpoint?.validationSupport ?? {},
    ).length,
    preparedAt: new Date().toISOString(),
    packages: packedPackages,
    proof: {
      strictValidation: "passed",
      artifactAudit: "passed",
      tarballManifestAudit: "passed",
    },
  };
  writeJsonAtomically(join(temporaryBatchDirectory, "manifest.json"), manifest);
  renameSync(temporaryBatchDirectory, batchDirectory);
  writePreparedNpmReleasePointer(
    join(batchDirectory, "manifest.json"),
    rootDir,
  );
  return {
    batchDirectory,
    manifest,
    manifestPath: join(batchDirectory, "manifest.json"),
  };
}

export function readPreparedNpmRelease(rootDir = ROOT_DIR) {
  const pointerPath = resolveLatestPointerPath(rootDir);
  if (!existsSync(pointerPath)) {
    throw new Error(
      "No prepared NPM release exists. Run `pnpm release:npm:prepare` before the release window.",
    );
  }
  const pointer = JSON.parse(readFileSync(pointerPath, "utf8"));
  if (
    pointer.schemaVersion !== SCHEMA_VERSION ||
    typeof pointer.manifestPath !== "string"
  ) {
    throw new Error(`Invalid prepared NPM pointer: ${pointerPath}`);
  }
  const preparedRoot = resolvePreparedNpmReleaseRoot(rootDir);
  const manifestPath = resolve(preparedRoot, pointer.manifestPath);
  if (
    !manifestPath.startsWith(`${preparedRoot}/`) ||
    !existsSync(manifestPath)
  ) {
    throw new Error(`Prepared NPM manifest is missing: ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return { batchDirectory: dirname(manifestPath), manifest, manifestPath };
}

export function validatePreparedNpmRelease(options = {}) {
  const {
    branch,
    registry,
    rootDir = ROOT_DIR,
    targetBranch,
    targetVersion,
  } = options;
  const record = options.record ?? readPreparedNpmRelease(rootDir);
  const { batchDirectory, manifest } = record;
  const issues = [];
  if (manifest.schemaVersion !== SCHEMA_VERSION)
    issues.push("schema version mismatch");
  if (branch && manifest.branch !== branch)
    issues.push(`branch ${manifest.branch} != ${branch}`);
  if (targetBranch && manifest.targetBranch !== targetBranch) {
    issues.push(`target branch ${manifest.targetBranch} != ${targetBranch}`);
  }
  if (targetVersion && manifest.targetVersion !== targetVersion) {
    issues.push(`target version ${manifest.targetVersion} != ${targetVersion}`);
  }
  if (registry && manifest.registry !== registry) {
    issues.push(`registry ${manifest.registry} != ${registry}`);
  }
  const currentFingerprint = computeReleaseTreeFingerprint(rootDir);
  if (manifest.treeFingerprint !== currentFingerprint) {
    issues.push("release tree fingerprint changed after preparation");
  }
  if (!Array.isArray(manifest.packages) || manifest.packages.length === 0) {
    issues.push("prepared package set is empty");
  } else {
    for (const entry of manifest.packages) {
      const tarballPath = resolve(batchDirectory, entry.tarballPath);
      if (
        !tarballPath.startsWith(`${batchDirectory}/`) ||
        !existsSync(tarballPath)
      ) {
        issues.push(`${entry.name}: tarball is missing`);
        continue;
      }
      if (sha512File(tarballPath) !== entry.sha512) {
        issues.push(`${entry.name}: tarball hash changed`);
      }
      if (statSync(tarballPath).size !== entry.size) {
        issues.push(`${entry.name}: tarball size changed`);
      }
    }
  }
  if (issues.length > 0) {
    throw new Error(
      `Prepared NPM release is stale or invalid:\n${issues.join("\n")}`,
    );
  }
  return record;
}

export {
  mapWithConcurrency,
  publishPreparedNpmRelease,
} from "./prepared-npm-publisher.mjs";
