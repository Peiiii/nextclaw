#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const childSpecs = [
  {
    name: "server",
    color: "\u001b[36m",
    command: pnpmBin,
    args: ["run", "dev:server"]
  },
  {
    name: "client",
    color: "\u001b[33m",
    command: pnpmBin,
    args: ["run", "dev:client"]
  }
];

const resetColor = "\u001b[0m";
const children = [];
let shuttingDown = false;

function shouldUseShell(command) {
  return process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
}

const stopChildren = (exitCode = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(exitCode);
  }, 1_500).unref();
};

for (const spec of childSpecs) {
  const child = spawn(spec.command, spec.args, {
    cwd: appRoot,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
    shell: shouldUseShell(spec.command)
  });

  const prefix = `${spec.color}[roadmap-portal:${spec.name}]${resetColor}`;
  child.stdout.on("data", (chunk) => {
    process.stdout.write(`${prefix} ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`${prefix} ${chunk}`);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`${prefix} exited with ${reason}`);
    stopChildren(code ?? 1);
  });
  children.push(child);
}

process.on("SIGINT", () => stopChildren(0));
process.on("SIGTERM", () => stopChildren(0));
