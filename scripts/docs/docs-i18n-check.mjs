#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const rootDir = resolve(process.cwd(), "apps/docs");
const enDir = resolve(rootDir, "en");
const zhDir = resolve(rootDir, "zh");
const legacyGuideDir = resolve(rootDir, "guide");

function collectMarkdownFiles(baseDir) {
  const results = [];

  function walk(currentDir) {
    for (const entry of readdirSync(currentDir)) {
      const absPath = join(currentDir, entry);
      const stats = statSync(absPath);
      if (stats.isDirectory()) {
        walk(absPath);
        continue;
      }
      if (entry.endsWith(".md")) {
        results.push(relative(baseDir, absPath));
      }
    }
  }

  walk(baseDir);
  return results.sort();
}

function printMismatch(title, files) {
  if (files.length === 0) {
    return;
  }
  console.error(`\n[docs-i18n-check] ${title} (${files.length})`);
  for (const file of files) {
    console.error(`  - ${file}`);
  }
}

if (!existsSync(enDir) || !existsSync(zhDir)) {
  console.error("[docs-i18n-check] Missing required locale directories: apps/docs/en and apps/docs/zh");
  process.exit(1);
}

if (existsSync(legacyGuideDir)) {
  console.error("[docs-i18n-check] Legacy directory detected: apps/docs/guide (must be removed)");
  process.exit(1);
}

const enFiles = collectMarkdownFiles(enDir);
const zhFiles = collectMarkdownFiles(zhDir);
const zhSet = new Set(zhFiles);
const enSet = new Set(enFiles);

const missingInZh = enFiles.filter((file) => !zhSet.has(file));
const missingInEn = zhFiles.filter((file) => !enSet.has(file));

printMismatch("Missing Chinese pages for English source", missingInZh);
printMismatch("Missing English pages for Chinese source", missingInEn);

if (missingInZh.length > 0 || missingInEn.length > 0) {
  process.exit(1);
}

console.log(`[docs-i18n-check] OK: ${enFiles.length} mirrored markdown pages in en/ and zh/`);
