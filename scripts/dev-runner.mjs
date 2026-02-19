#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2] ?? "start";

if (command !== "start") {
  console.error("Unsupported dev command. Use: pnpm dev start");
  process.exit(1);
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = resolve(rootDir, "packages/nextclaw");
const frontendDir = resolve(rootDir, "packages/nextclaw-ui");

const binName = process.platform === "win32" ? (name) => `${name}.cmd` : (name) => name;
const backendBin = resolve(backendDir, "node_modules/.bin", binName("tsx"));
const frontendBin = resolve(frontendDir, "node_modules/.bin", binName("vite"));

if (!existsSync(backendBin) || !existsSync(frontendBin)) {
  console.error("Missing local dev binaries. Run `pnpm install` at repo root first.");
  process.exit(1);
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
      console.error(`[dev:${label}] exited with signal ${signal}`);
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
  backendBin,
  [
    "watch",
    "--tsconfig",
    "tsconfig.json",
    "src/cli/index.ts",
    "serve",
    "--ui-port",
    "18792"
  ],
  backendDir
);

spawnProcess(
  "frontend",
  frontendBin,
  ["--host", "127.0.0.1", "--port", "5174", "--strictPort"],
  frontendDir,
  { VITE_API_BASE: "http://127.0.0.1:18792" }
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
