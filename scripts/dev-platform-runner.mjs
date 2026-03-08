#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createNetServer, Socket } from "node:net";

const argv = new Set(process.argv.slice(2));
const shouldMigrate = !argv.has("--no-migrate");
const checkOnly = argv.has("--check");

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = resolve(rootDir, "workers/nextclaw-provider-gateway-api");
const frontendDir = resolve(rootDir, "apps/platform-console");

const DEFAULT_BACKEND_PORT = 8787;
const DEFAULT_FRONTEND_PORT = 5176;
const PORT_SCAN_LIMIT = 20;

const binName = process.platform === "win32" ? (name) => `${name}.cmd` : (name) => name;
const workerBin = resolve(workerDir, "node_modules/.bin", binName("wrangler"));
const frontendBin = resolve(frontendDir, "node_modules/.bin", binName("vite"));

if (!existsSync(workerBin) || !existsSync(frontendBin)) {
  console.error("Missing local dev binaries. Run `pnpm install` at repo root first.");
  process.exit(1);
}

const workerConfig = resolve(workerDir, "wrangler.toml");
if (!existsSync(workerConfig)) {
  console.error(`Missing worker config: ${workerConfig}`);
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

const preferredBackendPort = toPort(process.env.NEXTCLAW_PLATFORM_BACKEND_PORT, DEFAULT_BACKEND_PORT);
const preferredFrontendPort = toPort(process.env.NEXTCLAW_PLATFORM_FRONTEND_PORT, DEFAULT_FRONTEND_PORT);
const wranglerPersistPath = typeof process.env.NEXTCLAW_PLATFORM_WRANGLER_PERSIST_TO === "string"
  ? process.env.NEXTCLAW_PLATFORM_WRANGLER_PERSIST_TO.trim()
  : "";

const backendPort = await resolveFreePort(preferredBackendPort, "127.0.0.1");
const frontendPort = await resolveFreePort(preferredFrontendPort, "127.0.0.1");

if (backendPort !== preferredBackendPort) {
  console.warn(`[platform] backend port ${preferredBackendPort} in use, fallback to ${backendPort}.`);
}
if (frontendPort !== preferredFrontendPort) {
  console.warn(`[platform] frontend port ${preferredFrontendPort} in use, fallback to ${frontendPort}.`);
}

console.log(`[platform] API: http://127.0.0.1:${backendPort}`);
console.log(`[platform] Frontend: http://127.0.0.1:${frontendPort}`);

if (checkOnly) {
  console.log("[platform] Check mode passed.");
  process.exit(0);
}

if (shouldMigrate) {
  console.log("[platform] Applying local D1 migrations before startup...");
  const migrateResult = spawnSync(
    workerBin,
    ["d1", "migrations", "apply", "NEXTCLAW_PLATFORM_DB", "--local", "--config", workerConfig],
    {
      cwd: rootDir,
      stdio: "inherit",
      env: { ...process.env }
    }
  );

  if (migrateResult.status !== 0) {
    process.exit(typeof migrateResult.status === "number" ? migrateResult.status : 1);
  }
}

const children = [];
let shuttingDown = false;
let requestedStop = false;
let exitCode = 0;

const spawnProcess = (label, cmd, args, cwd, extraEnv = {}) => {
  const child = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv }
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
      console.error(`[platform:${label}] exited with signal ${signal}`);
    }

    for (const proc of children) {
      if (proc !== child && proc.exitCode === null && !proc.killed) {
        proc.kill("SIGTERM");
      }
    }
  });
};

spawnProcess(
  "backend",
  workerBin,
  [
    "dev",
    "--local",
    "--port",
    String(backendPort),
    "--config",
    workerConfig,
    ...(wranglerPersistPath ? ["--persist-to", wranglerPersistPath] : [])
  ],
  rootDir
);

spawnProcess(
  "frontend",
  frontendBin,
  ["--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
  frontendDir,
  { VITE_PLATFORM_API_BASE: `http://127.0.0.1:${backendPort}` }
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
