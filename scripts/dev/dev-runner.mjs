#!/usr/bin/env node
import { existsSync, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { createServer as createNetServer } from "node:net";
import { homedir } from "node:os";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const command = process.argv[2] ?? "start";
const commandArgs = process.argv.slice(3);

if (command !== "start") {
  console.error("Unsupported dev command. Use: pnpm dev start");
  process.exit(1);
}

const rootDir = resolveRepoPath(import.meta.url);
const backendDir = resolve(rootDir, "packages/nextclaw");
const frontendDir = resolve(rootDir, "packages/nextclaw-ui");
const companionDir = resolve(rootDir, "apps/companion");
const explicitNextclawHome = typeof process.env.NEXTCLAW_HOME === "string" && process.env.NEXTCLAW_HOME.trim().length > 0 ? process.env.NEXTCLAW_HOME : null;
const nextclawHome = resolve(explicitNextclawHome ?? join(homedir(), ".nextclaw"));
const normalizeWatchPath = (filePath) => filePath.replaceAll("\\", "/");
const toRelativeWatchPath = (baseDir, targetPath) => {
  const normalizedRelative = normalizeWatchPath(relative(baseDir, targetPath));
  if (!normalizedRelative || normalizedRelative === ".") {
    return null;
  }
  if (normalizedRelative.startsWith("./")) {
    return normalizedRelative;
  }
  return `./${normalizedRelative}`;
};
const addWatchPathCandidates = (candidates, targetPath) => {
  candidates.add(normalizeWatchPath(targetPath));
  try {
    candidates.add(normalizeWatchPath(realpathSync(targetPath)));
  } catch {
    // Ignore realpath failures for non-existent or inaccessible paths.
  }
};
const buildTsxWatchExcludeGlobs = (baseDir, targetPaths) => {
  const candidates = new Set();
  for (const targetPath of targetPaths) {
    addWatchPathCandidates(candidates, targetPath);
  }
  const allPatterns = new Set();
  for (const candidate of candidates) {
    allPatterns.add(candidate);
    allPatterns.add(`${candidate}/**`);
    const relativeCandidate = toRelativeWatchPath(baseDir, candidate);
    if (relativeCandidate) {
      allPatterns.add(relativeCandidate);
      allPatterns.add(`${relativeCandidate}/**`);
    }
  }
  return [...allPatterns];
};
const firstPartyExtensionDir = resolve(rootDir, "packages/extensions");
const tsxWatchExcludeGlobs = buildTsxWatchExcludeGlobs(backendDir, [
  nextclawHome,
]);

const DEFAULT_BACKEND_PORT = 18792;
const DEFAULT_FRONTEND_PORT = 5174;
const PORT_SCAN_LIMIT = 20;
const BACKEND_READY_TIMEOUT_MS = 30_000;
const BACKEND_READY_POLL_MS = 100;

const binName = process.platform === "win32" ? (name) => `${name}.cmd` : (name) => name;
const backendBin = resolve(backendDir, "node_modules/.bin", binName("tsx"));
const frontendBin = resolve(frontendDir, "node_modules/.bin", binName("vite"));
const pnpmCliPath =
  typeof process.env.npm_execpath === "string" && process.env.npm_execpath.trim().length > 0
    ? process.env.npm_execpath
    : null;

if (!existsSync(backendBin) || !existsSync(frontendBin) || !pnpmCliPath) {
  console.error("Missing local dev binaries. Run `pnpm install` at repo root first.");
  process.exit(1);
}

function parseDevStartOptions(argv) {
  let backendWatchEnabled = process.env.NEXTCLAW_DEV_BACKEND_WATCH !== "0";
  let companionEnabled = process.env.NEXTCLAW_DEV_ENABLE_COMPANION === "1";
  let packageWatchEnabled = process.env.NEXTCLAW_DEV_PACKAGE_WATCH === "1";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--backend-watch") {
      backendWatchEnabled = true;
      continue;
    }
    if (arg === "--no-backend-watch") {
      backendWatchEnabled = false;
      continue;
    }
    if (arg === "--companion") {
      companionEnabled = true;
      continue;
    }
    if (arg === "--package-watch") {
      packageWatchEnabled = true;
      continue;
    }
    if (arg === "--no-package-watch") {
      packageWatchEnabled = false;
      continue;
    }
    throw new Error(`Unsupported dev option: ${arg}`);
  }

  return { backendWatchEnabled, companionEnabled, packageWatchEnabled };
}

let devStartOptions;
try {
  devStartOptions = parseDevStartOptions(commandArgs);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function toPort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isPortAvailable(port, host) {
  return new Promise((resolveAvailable) => {
    const server = createNetServer();
    server.unref();
    server.once("error", () => resolveAvailable(false));
    server.listen(port, host, () => {
      server.close(() => resolveAvailable(true));
    });
  });
}

async function resolveFreePort(startPort, host) {
  let current = startPort;
  for (let index = 0; index < PORT_SCAN_LIMIT; index += 1) {
    if (await isPortAvailable(current, host)) {
      return current;
    }
    current += 1;
  }
  throw new Error(`Unable to find a free port from ${startPort} (${host})`);
}

const preferredBackendPort = toPort(process.env.NEXTCLAW_DEV_BACKEND_PORT, DEFAULT_BACKEND_PORT);
const preferredFrontendPort = toPort(process.env.NEXTCLAW_DEV_FRONTEND_PORT, DEFAULT_FRONTEND_PORT);

const backendPort = await resolveFreePort(preferredBackendPort, "0.0.0.0");
const frontendPort = await resolveFreePort(preferredFrontendPort, "127.0.0.1");

if (backendPort !== preferredBackendPort) {
  console.warn(`[dev] Backend UI port ${preferredBackendPort} in use, fallback to ${backendPort}.`);
}
if (frontendPort !== preferredFrontendPort) {
  console.warn(`[dev] Frontend port ${preferredFrontendPort} in use, fallback to ${frontendPort}.`);
}
if (backendPort !== preferredBackendPort || frontendPort !== preferredFrontendPort) {
  console.warn(
    `[dev] Another dev instance may still be running on the default ports. Use the URLs printed below; the usual ports may still point to the older instance.`
  );
}

console.log(
  `[dev] Companion: ${devStartOptions.companionEnabled ? "enabled" : "disabled (pass --companion or set NEXTCLAW_DEV_ENABLE_COMPANION=1 to enable)"}`
);
console.log(
  `[dev] Backend watch: ${devStartOptions.backendWatchEnabled ? "enabled" : "disabled (pass --backend-watch or unset NEXTCLAW_DEV_BACKEND_WATCH=0 to enable)"}`
);
console.log(
  `[dev] Package dist watch: ${devStartOptions.packageWatchEnabled ? "enabled" : "disabled (pass --package-watch or set NEXTCLAW_DEV_PACKAGE_WATCH=1 to enable)"}`
);
console.log(`[dev] NEXTCLAW_HOME: ${nextclawHome}`);

const children = [];
let shuttingDown = false;
let requestedStop = false;
let exitCode = 0;
const developmentNodeOptions = [process.env.NODE_OPTIONS, "--conditions=development"]
  .filter((value) => typeof value === "string" && value.trim().length > 0)
  .join(" ");

function shouldUseShell(command) {
  return process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
}

const spawnProcess = (label, cmd, args, cwd, extraEnv = {}, options = {}) => {
  const critical = options.critical !== false;
  const child = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: shouldUseShell(cmd)
  });

  children.push(child);

  child.on("error", (error) => {
    if (requestedStop || shuttingDown) {
      return;
    }
    console.error(`[dev:${label}] failed to start: ${error instanceof Error ? error.message : String(error)}`);
    if (critical) {
      shuttingDown = true;
      exitCode = 1;
      terminateChildren(child, "SIGTERM");
    }
  });

  child.on("exit", (code, signal) => {
    if (requestedStop || shuttingDown) {
      return;
    }
    if (!critical) {
      if (typeof code === "number" && code !== 0) {
        console.error(`[dev:${label}] exited with code ${code}`);
      } else if (signal) {
        console.error(`[dev:${label}] exited with signal ${signal}`);
      }
      return;
    }

    shuttingDown = true;
    if (typeof code === "number") {
      exitCode = code;
    } else if (signal) {
      exitCode = 1;
      console.error(`[dev:${label}] exited with signal ${signal}`);
    }

    terminateChildren(child, "SIGTERM");
  });

  return child;
};

const terminateChildren = (exceptChild, signal) => {
  for (const child of children) {
    if (child !== exceptChild && child.exitCode === null && !child.killed) {
      child.kill(signal);
    }
  }
};

const stopAll = (signal) => {
  if (shuttingDown) {
    return;
  }
  requestedStop = true;
  shuttingDown = true;
  exitCode = 0;
  terminateChildren(null, signal);
};

const failStartup = (error) => {
  if (shuttingDown) {
    return;
  }
  console.error(error instanceof Error ? error.message : String(error));
  shuttingDown = true;
  exitCode = 1;
  terminateChildren(null, "SIGTERM");
};

async function waitForBackendReady(child, port, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (typeof child.exitCode === "number") {
      throw new Error(`[dev:backend] exited before accepting connections on port ${port}.`);
    }
    try {
      await fetch(`http://127.0.0.1:${port}/api/app/meta`, { signal: globalThis.AbortSignal.timeout(250) });
      return;
    } catch { await new Promise((resolveDelay) => setTimeout(resolveDelay, BACKEND_READY_POLL_MS)); }
  }
  throw new Error(`[dev:backend] timed out waiting for port ${port} to accept connections after ${timeoutMs}ms.`);
}

if (devStartOptions.packageWatchEnabled) {
  spawnProcess(
    "package-watch",
    process.execPath,
    [resolve(rootDir, "scripts/dev/workspace-package-dist-watcher.mjs"), "--watch"],
    rootDir,
    {},
    { critical: false }
  );
}

const backendProcess = spawnProcess(
  "backend",
  backendBin,
  [
    ...(devStartOptions.backendWatchEnabled
      ? ["watch", ...tsxWatchExcludeGlobs.flatMap((glob) => ["--exclude", glob])]
      : []),
    "--tsconfig",
    resolve(rootDir, "scripts/dev/dev-runtime.tsconfig.json"),
    "src/cli/app/index.ts",
    "serve",
    "--ui-port",
    String(backendPort)
  ],
  backendDir,
  {
    NODE_OPTIONS: developmentNodeOptions,
    NEXTCLAW_DEV_FIRST_PARTY_EXTENSION_DIR: firstPartyExtensionDir,
    NEXTCLAW_DISABLE_STATIC_UI: "1",
    NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST: "1",
    NEXTCLAW_REMOTE_LOCAL_ORIGIN: `http://127.0.0.1:${frontendPort}`,
    NEXTCLAW_HOME: nextclawHome
  }
);

console.log(`[dev] Waiting for backend to accept connections on http://127.0.0.1:${backendPort}...`);
try {
  await waitForBackendReady(backendProcess, backendPort, BACKEND_READY_TIMEOUT_MS);
} catch (error) {
  failStartup(error);
}
if (shuttingDown) {
  process.exit(exitCode);
}
console.log(`[dev] Backend ready; starting frontend: http://127.0.0.1:${frontendPort}`);
spawnProcess(
  "frontend",
  frontendBin,
  ["--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
  frontendDir,
  { VITE_DEV_PROXY_API_BASE: `http://127.0.0.1:${backendPort}` }
);

if (devStartOptions.companionEnabled) {
  spawnProcess(
    "companion",
    process.execPath,
    [pnpmCliPath, "-C", companionDir, "dev", "--", "--base-url", `http://127.0.0.1:${backendPort}`],
    rootDir,
    {},
    { critical: false }
  );
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => stopAll(signal));
}

const waitForExit = setInterval(() => {
  const allExited = children.length > 0 && children.every((child) => child.exitCode !== null || child.killed);
  if (!allExited) {
    return;
  }
  clearInterval(waitForExit);
  process.exit(exitCode);
}, 100);

setTimeout(() => {
  if (shuttingDown) {
    process.exit(exitCode);
  }
}, 3000);
