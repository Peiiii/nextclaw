#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const forwardedArgs = process.argv.slice(2);

const checks = [
  {
    name: "file-name-kebab-case",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-file-names.mjs")],
  },
  {
    name: "class-methods-arrow",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-class-methods.mjs")],
  },
  {
    name: "object-methods-arrow",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-object-methods.mjs")],
  },
  {
    name: "param-mutations-owner-boundary",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-param-mutations.mjs")],
  },
  {
    name: "react-effects-owner-boundary",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-react-effects.mjs")],
  },
  {
    name: "closure-objects-owner",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-closure-objects.mjs")],
  },
  {
    name: "context-destructuring",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-context-destructuring.mjs")],
  },
  {
    name: "file-directory-collisions",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-file-directory-collisions.mjs")],
  },
  {
    name: "flat-directories-subtree",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-flat-directories.mjs")],
  },
  {
    name: "frozen-directories",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-frozen-directories.mjs")],
  },
  {
    name: "stateful-orchestrators-owner",
    command: "node",
    args: [path.join(scriptDir, "lint-new-code-stateful-orchestrators.mjs")],
  },
];

for (const check of checks) {
  process.stdout.write(`\n[governance] running ${check.name}\n`);
  const result = spawnSync(check.command, [...check.args, ...forwardedArgs], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
  if (result.error) {
    throw result.error;
  }
}

process.stdout.write("\n[governance] all checks passed\n");
