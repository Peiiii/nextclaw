#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function normalizeChannel(value) {
  return value?.trim().toLowerCase() === "beta" ? "beta" : "stable";
}

function readRequiredOption(args, key) {
  const value = args[key]?.trim();
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = resolve(readRequiredOption(args, "output"));
  const releaseTag = args["release-tag"]?.trim() || null;
  const manifestBaseUrl = args["manifest-base-url"]?.trim() || null;
  const metadata = {
    channel: normalizeChannel(args.channel),
    releaseTag,
    manifestBaseUrl
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  process.stdout.write(`${outputPath}\n`);
}

try {
  main();
} catch (error) {
  console.error(`[write-release-metadata] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
