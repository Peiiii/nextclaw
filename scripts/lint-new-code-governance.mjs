#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const checks = [
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
];

for (const check of checks) {
  process.stdout.write(`\n[governance] running ${check.name}\n`);
  const result = spawnSync(check.command, check.args, {
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
