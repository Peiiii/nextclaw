#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceDir = resolve(packageDir, "src/hermes-acp-route-bridge");
const targetDir = resolve(packageDir, "dist/hermes-acp-route-bridge");

function collectFiles(rootDir, currentDir = rootDir) {
  if (!existsSync(currentDir)) {
    return [];
  }
  const entries = readdirSync(currentDir).sort((left, right) => left.localeCompare(right));
  const output = [];
  for (const entry of entries) {
    const entryPath = resolve(currentDir, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      output.push(...collectFiles(rootDir, entryPath));
      continue;
    }
    output.push(relative(rootDir, entryPath));
  }
  return output;
}

function fail(message) {
  console.error(`[hermes-acp-bridge] ${message}`);
  process.exit(1);
}

if (!existsSync(sourceDir)) {
  fail(`missing source bridge directory: ${sourceDir}`);
}

if (!existsSync(targetDir)) {
  fail(`missing dist bridge directory: ${targetDir}. Run 'pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge build'.`);
}

const sourceFiles = collectFiles(sourceDir);
const targetFiles = collectFiles(targetDir);

if (JSON.stringify(sourceFiles) !== JSON.stringify(targetFiles)) {
  fail(
    `source/dist bridge file sets differ. Run 'pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge build' to resync.`,
  );
}

for (const relativePath of sourceFiles) {
  const sourcePath = resolve(sourceDir, relativePath);
  const targetPath = resolve(targetDir, relativePath);
  const sourceContent = readFileSync(sourcePath, "utf8");
  const targetContent = readFileSync(targetPath, "utf8");
  if (sourceContent !== targetContent) {
    fail(
      `source/dist bridge content differs for '${relativePath}'. Run 'pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge build' to resync.`,
    );
  }
}

console.log("[hermes-acp-bridge] source and dist bridge files are in sync.");
