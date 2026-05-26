#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const forwardedArgs = process.argv.slice(2);

const checkScripts = [
  ["file-name-kebab-case", "lint-new-code-file-names.mjs"],
  ["directory-name-kebab-case", "lint-new-code-directory-names.mjs"],
  ["doc-file-name-kebab-case", "lint-doc-file-names.mjs"],
  ["file-role-boundaries", "lint-new-code-file-role-boundaries.mjs"],
  ["module-structure-drift", "module-structure/lint-new-code-module-structure.mjs"],
  ["package-public-imports", "lint-new-code-package-public-imports.mjs"],
  ["class-methods-arrow", "lint-new-code-class-methods.mjs"],
  ["object-methods-arrow", "lint-new-code-object-methods.mjs"],
  ["param-mutations-owner-boundary", "lint-new-code-param-mutations.mjs"],
  ["react-effects-owner-boundary", "lint-new-code-react-effects.mjs"],
  ["closure-objects-owner", "lint-new-code-closure-objects.mjs"],
  ["context-destructuring", "lint-new-code-context-destructuring.mjs"],
  ["file-directory-collisions", "lint-new-code-file-directory-collisions.mjs"],
  ["flat-directories-subtree", "lint-new-code-flat-directories.mjs"],
  ["frozen-directories", "lint-new-code-frozen-directories.mjs"],
  ["stateful-orchestrators-owner", "lint-new-code-stateful-orchestrators.mjs"],
];

const legacyAgentEntryPatterns = [
  /\bAgentLoop\b/,
  /\bNativeAgentEngine\b/,
  /\bruntimePool\b/,
  /\bGatewayAgentRuntimePool\b/,
  /\bprocessDirect\s*\(/,
];

function* walkLiveCodeFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["dist", "node_modules", "ui-dist"].includes(entry.name)) {
        yield* walkLiveCodeFiles(fullPath);
      }
      continue;
    }
    if (/\.(?:cjs|js|mjs|ts|tsx)$/.test(entry.name)) {
      yield fullPath;
    }
  }
}

function runLegacyAgentEntrypointCheck() {
  const findings = [];
  for (const rootName of ["packages", "apps", "workers"]) {
    const rootDir = path.join(repoRoot, rootName);
    if (!fs.existsSync(rootDir)) {
      continue;
    }
    for (const filePath of walkLiveCodeFiles(rootDir)) {
      const lines = fs.readFileSync(filePath, "utf8").split("\n");
      for (const [index, line] of lines.entries()) {
        if (legacyAgentEntryPatterns.some((pattern) => pattern.test(line))) {
          findings.push(`${path.relative(repoRoot, filePath)}:${index + 1}: ${line.trim()}`);
        }
      }
    }
  }
  if (findings.length === 0) {
    process.stdout.write("Legacy agent direct-entrypoint scan passed for live code.\n");
    return;
  }
  console.error("Legacy agent direct-entrypoint scan failed. Use the NCP agent-run main chain instead.");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

for (const [name, scriptPath] of checkScripts) {
  process.stdout.write(`\n[governance] running ${name}\n`);
  const result = spawnSync("node", [path.join(scriptDir, scriptPath), ...forwardedArgs], {
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

process.stdout.write("\n[governance] running legacy-agent-direct-entrypoints\n");
runLegacyAgentEntrypointCheck();

process.stdout.write("\n[governance] all checks passed\n");
