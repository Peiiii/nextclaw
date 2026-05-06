#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

execFileSync("node", ["scripts/release/release-beta.mjs", "--skip-runtime-channel", ...args], {
  cwd: rootDir,
  stdio: "inherit"
});
