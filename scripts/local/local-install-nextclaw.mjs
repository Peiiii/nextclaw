#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = resolve(rootDir, "packages/nextclaw");

function binName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args, options = {}) {
  console.log(`[local-install] run: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function readStdout(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: process.env
  });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

function resolveGlobalNextclawBin() {
  const globalPrefix = readStdout(binName("npm"), ["prefix", "--global"]);
  if (!globalPrefix) {
    return binName("nextclaw");
  }

  const candidate =
    process.platform === "win32"
      ? resolve(globalPrefix, binName("nextclaw"))
      : resolve(globalPrefix, "bin", "nextclaw");
  return existsSync(candidate) ? candidate : binName("nextclaw");
}

function createPnpmLinkEnv() {
  const globalPrefix = readStdout(binName("npm"), ["prefix", "--global"]);
  if (!globalPrefix) {
    return process.env;
  }

  const pnpmHome =
    process.platform === "win32" ? globalPrefix : resolve(globalPrefix, "bin");

  return {
    ...process.env,
    PNPM_HOME: pnpmHome,
    PATH: `${pnpmHome}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`
  };
}

run(binName("pnpm"), ["-r", "--filter", "nextclaw...", "build"]);
run(binName("pnpm"), ["-C", "packages/nextclaw", "link", "--global"], {
  env: createPnpmLinkEnv()
});

const nextclawBin = resolveGlobalNextclawBin();
run(nextclawBin, ["--version"]);
console.log(`[local-install] nextclaw is linked globally from: ${packageDir}`);
console.log(`[local-install] nextclaw binary is ready: ${nextclawBin}`);
