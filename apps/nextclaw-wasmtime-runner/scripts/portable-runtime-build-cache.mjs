import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const CACHE_SCHEMA = 1;
const DEFAULT_CACHE_WAIT_INTERVAL_MS = 250;
const DEFAULT_CACHE_LOCK_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_STALE_CACHE_LOCK_MS = 2 * 60 * 60 * 1000;
const CACHE_ENVIRONMENT_PATTERN = /^(?:AR|CC|CXX|SDKROOT|MACOSX_DEPLOYMENT_TARGET|RUSTFLAGS|CARGO_ENCODED_RUSTFLAGS|CARGO_BUILD_RUSTFLAGS|CARGO_PROFILE_RELEASE_.+|CARGO_TARGET_[A-Z0-9_]+_(?:LINKER|RUSTFLAGS))$/;

function runCaptured(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const details = String(result.stderr || result.stdout || "").trim();
    throw new Error(`${command} ${args.join(" ")} failed${details ? `: ${details}` : "."}`);
  }
  return String(result.stdout).trim();
}

function resolveToolchainIdentity(plan, providedIdentity) {
  if (providedIdentity) return String(providedIdentity);
  return [
    runCaptured("rustc", ["-vV"], plan.sourceRoot),
    runCaptured("cargo", ["component", "--version"], plan.sourceRoot),
  ].join("\n");
}

async function collectFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

async function collectBuildInputFiles(plan) {
  const fixedFiles = ["Cargo.toml", "Cargo.lock", "rust-toolchain.toml"]
    .map((name) => join(plan.sourceRoot, name));
  const directoryFiles = [
    ...await collectFiles(join(plan.sourceRoot, "src")),
    ...await collectFiles(join(plan.sourceRoot, "wit")),
  ];
  const guestRoot = join(plan.sourceRoot, "guests");
  const guestDirectories = (await readdir(guestRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const guest of guestDirectories) {
    fixedFiles.push(join(guestRoot, guest, "Cargo.toml"));
    directoryFiles.push(...await collectFiles(join(guestRoot, guest, "src")));
  }
  return [...fixedFiles, ...directoryFiles].sort((left, right) => (
    relative(plan.sourceRoot, left).localeCompare(relative(plan.sourceRoot, right))
  ));
}

function fingerprintEnvironment() {
  return Object.entries(process.env)
    .filter(([name]) => CACHE_ENVIRONMENT_PATTERN.test(name))
    .sort(([left], [right]) => left.localeCompare(right));
}

export async function createPortableRuntimeFingerprint(plan, options = {}) {
  const hash = createHash("sha256");
  const contract = {
    schema: CACHE_SCHEMA,
    target: plan.target,
    cargoTarget: plan.cargoTarget,
    commands: plan.commands,
    guests: plan.guests.map(({ componentId }) => componentId),
    toolchain: resolveToolchainIdentity(plan, options.toolchainIdentity),
    environment: fingerprintEnvironment(),
  };
  hash.update(JSON.stringify(contract));
  for (const path of await collectBuildInputFiles(plan)) {
    const relativePath = relative(plan.sourceRoot, path);
    const contents = await readFile(path);
    hash.update(`\0${relativePath}\0${contents.byteLength}\0`);
    hash.update(contents);
  }
  return hash.digest("hex");
}

export function resolvePortableRuntimeCacheRoot(plan, options = {}) {
  const configuredRoot = options.cacheRoot ?? process.env.NEXTCLAW_PORTABLE_RUNTIME_CACHE_DIR;
  if (configuredRoot) return resolve(plan.sourceRoot, configuredRoot);
  const workspaceRoot = resolve(plan.sourceRoot, "../..");
  const result = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status === 0 && String(result.stdout).trim()) {
    const gitCommonDirectory = resolve(workspaceRoot, String(result.stdout).trim());
    return join(gitCommonDirectory, "nextclaw-cache", "portable-runtime");
  }
  return join(plan.sourceRoot, "target", ".nextclaw-product-cache");
}

async function hashFile(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function matchesRecordedArtifact(path, recorded) {
  try {
    const metadata = await stat(path);
    return metadata.size === recorded.bytes && await hashFile(path) === recorded.sha256;
  } catch {
    return false;
  }
}

function expectedCacheArtifacts(plan) {
  return [
    {
      key: "runner",
      cachePath: "artifacts/runner",
      source: plan.runner.source,
      destination: plan.runner.destination,
      executable: true,
    },
    ...plan.guests.map((guest) => ({
      key: guest.componentId,
      cachePath: `artifacts/guests/${guest.componentId}.wasm`,
      source: guest.source,
      destination: guest.destination,
      executable: false,
    })),
  ];
}

async function readValidatedCache(cacheDirectory, plan, fingerprint) {
  try {
    const manifest = JSON.parse(await readFile(join(cacheDirectory, "manifest.json"), "utf8"));
    const expected = expectedCacheArtifacts(plan);
    if (
      manifest.schema !== CACHE_SCHEMA
      || manifest.fingerprint !== fingerprint
      || manifest.target !== plan.target
      || !Array.isArray(manifest.artifacts)
      || manifest.artifacts.length !== expected.length
    ) {
      return null;
    }
    const manifestByKey = new Map(manifest.artifacts.map((artifact) => [artifact.key, artifact]));
    for (const artifact of expected) {
      const recorded = manifestByKey.get(artifact.key);
      if (
        !recorded
        || recorded.path !== artifact.cachePath
        || recorded.executable !== artifact.executable
      ) return null;
      if (!await matchesRecordedArtifact(join(cacheDirectory, artifact.cachePath), recorded)) return null;
    }
    return { manifest, artifacts: expected };
  } catch {
    return null;
  }
}

export async function syncArtifactAtomically(source, destination, executable = false) {
  await mkdir(dirname(destination), { recursive: true });
  const temporaryPath = `${destination}.tmp-${process.pid}-${Date.now()}`;
  try {
    await copyFile(source, temporaryPath);
    if (executable) await chmod(temporaryPath, 0o755);
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
  return { destination, bytes: (await stat(destination)).size };
}

async function materializeCache(cacheDirectory, validatedCache) {
  const manifestByKey = new Map(
    validatedCache.manifest.artifacts.map((artifact) => [artifact.key, artifact]),
  );
  let runner;
  const guests = [];
  for (const artifact of validatedCache.artifacts) {
    const recorded = manifestByKey.get(artifact.key);
    const result = await matchesRecordedArtifact(artifact.destination, recorded)
      ? { destination: artifact.destination, bytes: recorded.bytes }
      : await syncArtifactAtomically(
        join(cacheDirectory, recorded.path),
        artifact.destination,
        artifact.executable,
      );
    if (artifact.key === "runner") runner = result;
    else guests.push(result);
  }
  return { runner, guests };
}

async function createCacheBuildResult(plan, cacheDirectory, validatedCache, status, fingerprint) {
  const materialized = await materializeCache(cacheDirectory, validatedCache);
  return {
    target: plan.target,
    ...materialized,
    cache: { status, fingerprint, directory: cacheDirectory },
  };
}

async function publishCache(cacheDirectory, plan, fingerprint) {
  const parentDirectory = dirname(cacheDirectory);
  await mkdir(parentDirectory, { recursive: true });
  const temporaryDirectory = join(
    parentDirectory,
    `.${fingerprint}.tmp-${process.pid}-${Date.now()}`,
  );
  const manifestArtifacts = [];
  try {
    for (const artifact of expectedCacheArtifacts(plan)) {
      const cachePath = join(temporaryDirectory, artifact.cachePath);
      await mkdir(dirname(cachePath), { recursive: true });
      await copyFile(artifact.source, cachePath);
      if (artifact.executable) await chmod(cachePath, 0o755);
      const metadata = await stat(cachePath);
      manifestArtifacts.push({
        key: artifact.key,
        path: artifact.cachePath,
        bytes: metadata.size,
        sha256: await hashFile(cachePath),
        executable: artifact.executable,
      });
    }
    await writeFile(join(temporaryDirectory, "manifest.json"), `${JSON.stringify({
      schema: CACHE_SCHEMA,
      fingerprint,
      target: plan.target,
      cargoTarget: plan.cargoTarget,
      artifacts: manifestArtifacts,
    }, null, 2)}\n`);
    await rm(cacheDirectory, { recursive: true, force: true });
    await rename(temporaryDirectory, cacheDirectory);
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function acquireCacheLock(lockPath, cacheDirectory, plan, fingerprint, options) {
  const {
    cacheLockTimeoutMs,
    cacheStaleLockMs,
    cacheWaitIntervalMs,
    rebuild,
  } = options;
  const startedAt = Date.now();
  const waitIntervalMs = cacheWaitIntervalMs ?? DEFAULT_CACHE_WAIT_INTERVAL_MS;
  const lockTimeoutMs = cacheLockTimeoutMs ?? DEFAULT_CACHE_LOCK_TIMEOUT_MS;
  const staleLockMs = cacheStaleLockMs ?? DEFAULT_STALE_CACHE_LOCK_MS;
  let waitingLogged = false;
  await mkdir(dirname(lockPath), { recursive: true });
  while (true) {
    try {
      await mkdir(lockPath);
      return { acquired: true, waited: waitingLogged };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    if (!rebuild) {
      const cache = await readValidatedCache(cacheDirectory, plan, fingerprint);
      if (cache) return { acquired: false, waited: true, cache };
    }
    if (!waitingLogged) {
      console.log(`[portable-runtime] waiting for build ${fingerprint.slice(0, 12)}`);
      waitingLogged = true;
    }
    try {
      const lockMetadata = await stat(lockPath);
      if (Date.now() - lockMetadata.mtimeMs > staleLockMs) {
        await rm(lockPath, { recursive: true, force: true });
        continue;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      continue;
    }
    if (Date.now() - startedAt > lockTimeoutMs) {
      throw new Error(`Timed out waiting for Portable Runtime cache lock: ${lockPath}`);
    }
    await delay(waitIntervalMs);
  }
}

export async function buildPortableRuntimeFromCache(plan, options, executeBuild) {
  const fingerprint = await createPortableRuntimeFingerprint(plan, options);
  const cacheRoot = resolvePortableRuntimeCacheRoot(plan, options);
  const cacheDirectory = join(cacheRoot, plan.target, fingerprint);
  const lockPath = `${cacheDirectory}.lock`;
  if (!options.rebuild) {
    const cached = await readValidatedCache(cacheDirectory, plan, fingerprint);
    if (cached) {
      console.log(`[portable-runtime] cache hit ${fingerprint.slice(0, 12)}`);
      return await createCacheBuildResult(plan, cacheDirectory, cached, "hit", fingerprint);
    }
  }
  const lock = await acquireCacheLock(lockPath, cacheDirectory, plan, fingerprint, options);
  if (!lock.acquired) {
    console.log(`[portable-runtime] cache hit after wait ${fingerprint.slice(0, 12)}`);
    return await createCacheBuildResult(plan, cacheDirectory, lock.cache, "wait-hit", fingerprint);
  }
  try {
    if (!options.rebuild) {
      const cached = await readValidatedCache(cacheDirectory, plan, fingerprint);
      if (cached) {
        console.log(`[portable-runtime] cache hit after wait ${fingerprint.slice(0, 12)}`);
        const status = lock.waited ? "wait-hit" : "hit";
        return await createCacheBuildResult(plan, cacheDirectory, cached, status, fingerprint);
      }
    }
    const status = options.rebuild ? "rebuild" : "miss";
    console.log(`[portable-runtime] cache ${status} ${fingerprint.slice(0, 12)}`);
    await executeBuild(plan);
    await publishCache(cacheDirectory, plan, fingerprint);
    console.log(`[portable-runtime] cache published ${fingerprint.slice(0, 12)}`);
    const published = await readValidatedCache(cacheDirectory, plan, fingerprint);
    if (!published) throw new Error(`Portable Runtime cache verification failed: ${cacheDirectory}`);
    return await createCacheBuildResult(plan, cacheDirectory, published, status, fingerprint);
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}
