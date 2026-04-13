#!/usr/bin/env node
import { existsSync, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createNetServer, Socket } from "node:net";
import { homedir } from "node:os";
import {
  createPluginOverrideValue,
  validatePluginOverride,
} from "./dev-plugin-overrides-support.mjs";

const command = process.argv[2] ?? "start";
const commandArgs = process.argv.slice(3);
const DEV_PLUGIN_OVERRIDES_ENV = "NEXTCLAW_DEV_PLUGIN_OVERRIDES";

if (command !== "start") {
  console.error("Unsupported dev command. Use: pnpm dev start");
  process.exit(1);
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = resolve(rootDir, "packages/nextclaw");
const frontendDir = resolve(rootDir, "packages/nextclaw-ui");
const explicitNextclawHome =
  typeof process.env.NEXTCLAW_HOME === "string" && process.env.NEXTCLAW_HOME.trim().length > 0
    ? process.env.NEXTCLAW_HOME
    : null;
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
const buildTsxWatchExcludeGlobs = (homePath, baseDir) => {
  const candidates = new Set([normalizeWatchPath(homePath)]);
  try {
    candidates.add(normalizeWatchPath(realpathSync(homePath)));
  } catch {
    // Ignore realpath failures for non-existent or inaccessible home paths.
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
const tsxWatchExcludeGlobs = buildTsxWatchExcludeGlobs(nextclawHome, backendDir);
const firstPartyPluginDir = resolve(rootDir, "packages/extensions");

const DEFAULT_BACKEND_PORT = 18792;
const DEFAULT_FRONTEND_PORT = 5174;
const PORT_SCAN_LIMIT = 20;
const BACKEND_READY_TIMEOUT_MS = 30_000;
const BACKEND_READY_POLL_MS = 100;

const binName = process.platform === "win32" ? (name) => `${name}.cmd` : (name) => name;
const backendBin = resolve(backendDir, "node_modules/.bin", binName("tsx"));
const frontendBin = resolve(frontendDir, "node_modules/.bin", binName("vite"));

if (!existsSync(backendBin) || !existsSync(frontendBin)) {
  console.error("Missing local dev binaries. Run `pnpm install` at repo root first.");
  process.exit(1);
}

function parsePluginOverrideArg(rawValue) {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new Error(
      `Invalid --plugin-override value "${rawValue}". Expected <pluginId>=<path>[#production|#development].`
    );
  }

  const pluginId = value.slice(0, separatorIndex).trim();
  let pluginPath = value.slice(separatorIndex + 1).trim();
  let source = "production";
  if (pluginPath.endsWith("#development")) {
    pluginPath = pluginPath.slice(0, -"#development".length);
    source = "development";
  } else if (pluginPath.endsWith("#production")) {
    pluginPath = pluginPath.slice(0, -"#production".length);
  }

  const normalizedPath = resolve(rootDir, pluginPath.trim());
  if (!pluginId || !pluginPath.trim()) {
    throw new Error(
      `Invalid --plugin-override value "${rawValue}". Expected <pluginId>=<path>[#production|#development].`
    );
  }

  return {
    pluginId,
    pluginPath: normalizedPath,
    source,
  };
}

function parseDevStartOptions(argv) {
  const pluginOverrides = [];
  const seenPluginIds = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plugin-override") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--plugin-override requires a value.");
      }
      const override = parsePluginOverrideArg(next);
      if (seenPluginIds.has(override.pluginId)) {
        throw new Error(`Duplicate --plugin-override for "${override.pluginId}".`);
      }
      validatePluginOverride(override);
      seenPluginIds.add(override.pluginId);
      pluginOverrides.push(override);
      index += 1;
      continue;
    }
    throw new Error(`Unsupported dev option: ${arg}`);
  }

  return { pluginOverrides };
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

function isPortOccupied(port, host) {
  return new Promise((resolveOccupied) => {
    const socket = new Socket();
    let settled = false;

    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolveOccupied(value);
    };

    socket.setTimeout(250, () => finalize(false));
    socket.once("connect", () => finalize(true));
    socket.once("error", (error) => {
      const code = typeof error?.code === "string" ? error.code : "";
      if (code === "ECONNREFUSED" || code === "EHOSTUNREACH" || code === "ENETUNREACH") {
        finalize(false);
        return;
      }
      finalize(true);
    });

    socket.connect(port, host);
  });
}

async function resolveFreePort(startPort, host) {
  let current = startPort;
  for (let index = 0; index < PORT_SCAN_LIMIT; index += 1) {
    const occupied = await isPortOccupied(current, "127.0.0.1");
    if (!occupied && (await isPortAvailable(current, host))) {
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

console.log(`[dev] API base: http://127.0.0.1:${backendPort}`);
console.log(`[dev] Frontend: http://127.0.0.1:${frontendPort}`);
console.log(`[dev] NEXTCLAW_HOME: ${nextclawHome}`);
if (devStartOptions.pluginOverrides.length > 0) {
  console.log(
    `[dev] Plugin overrides: ${devStartOptions.pluginOverrides
      .map((entry) => createPluginOverrideValue(entry))
      .join(", ")}`
  );
}

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

const spawnProcess = (label, cmd, args, cwd, extraEnv = {}) => {
  const child = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: shouldUseShell(cmd)
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (requestedStop || shuttingDown) {
      return;
    }

    shuttingDown = true;
    if (typeof code === "number") {
      exitCode = code;
    } else if (signal) {
      exitCode = 1;
      console.error(`[dev:${label}] exited with signal ${signal}`);
    }

    for (const proc of children) {
      if (proc !== child && proc.exitCode === null && !proc.killed) {
        proc.kill("SIGTERM");
      }
    }
  });

  return child;
};

async function waitForBackendReady(child, port, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (typeof child.exitCode === "number") {
      throw new Error(`[dev:backend] exited before accepting connections on port ${port}.`);
    }
    if (await isPortOccupied(port, "127.0.0.1")) {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, BACKEND_READY_POLL_MS));
  }
  throw new Error(`[dev:backend] timed out waiting for port ${port} to accept connections after ${timeoutMs}ms.`);
}

const backendProcess = spawnProcess(
  "backend",
  backendBin,
  [
    "watch",
    ...tsxWatchExcludeGlobs.flatMap((glob) => ["--exclude", glob]),
    "--tsconfig",
    "tsconfig.json",
    "src/cli/index.ts",
    "serve",
    "--ui-port",
    String(backendPort)
  ],
  backendDir,
  {
    NODE_OPTIONS: developmentNodeOptions,
    NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR: firstPartyPluginDir,
    ...(devStartOptions.pluginOverrides.length > 0
      ? {
          [DEV_PLUGIN_OVERRIDES_ENV]: JSON.stringify(devStartOptions.pluginOverrides),
        }
      : {}),
    NEXTCLAW_DISABLE_STATIC_UI: "1",
    NEXTCLAW_REMOTE_LOCAL_ORIGIN: `http://127.0.0.1:${frontendPort}`,
    NEXTCLAW_HOME: nextclawHome
  }
);

await waitForBackendReady(backendProcess, backendPort, BACKEND_READY_TIMEOUT_MS);

spawnProcess(
  "frontend",
  frontendBin,
  ["--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
  frontendDir,
  { VITE_DEV_PROXY_API_BASE: `http://127.0.0.1:${backendPort}` }
);

const stopAll = (signal) => {
  if (shuttingDown) {
    return;
  }
  requestedStop = true;
  shuttingDown = true;
  exitCode = 0;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) {
      child.kill(signal);
    }
  }
};

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
