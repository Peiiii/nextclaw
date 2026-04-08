#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const options = {
    gpgHome: "",
    keyId: "",
    output: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--gpg-home") {
      options.gpgHome = value ?? "";
      index += 1;
      continue;
    }
    if (arg === "--key-id") {
      options.keyId = value ?? "";
      index += 1;
      continue;
    }
    if (arg === "--output") {
      options.output = value ?? "";
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.gpgHome || !options.keyId || !options.output) {
    throw new Error("Usage: node scripts/export-linux-apt-public-key.mjs --gpg-home <path> --key-id <id> --output <path>");
  }

  return {
    gpgHome: resolve(options.gpgHome),
    keyId: options.keyId,
    output: resolve(options.output)
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr.toString("utf8")}`);
  }
  return result.stdout;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputDir = dirname(options.output);
  mkdirSync(outputDir, { recursive: true });

  const keyData = run("gpg", ["--homedir", options.gpgHome, "--batch", "--yes", "--export", options.keyId]);
  writeFileSync(options.output, keyData);
  console.log(`[linux-apt-key] wrote ${options.output}`);
}

main();
