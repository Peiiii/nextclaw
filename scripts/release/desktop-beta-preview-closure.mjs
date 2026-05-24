#!/usr/bin/env node

import { waitForDesktopReleaseClosure } from "./desktop-release-closure.mjs";

const DEFAULT_REPO = "Peiiii/nextclaw";
const DEFAULT_WORKFLOW = "desktop-release.yml";
const DEFAULT_PUBLIC_ATTEMPTS = 18;
const DEFAULT_PUBLIC_DELAY_MS = 10000;
const DEFAULT_RUN_ATTEMPTS = 120;
const DEFAULT_RUN_DELAY_MS = 10000;

function printHelp() {
  console.log(`
Usage:
  node scripts/release/desktop-beta-preview-closure.mjs --tag <tag> --desktop-version <version> --runtime-version <version> [options]

Options:
  --repo <owner/repo>             GitHub repository, default: ${DEFAULT_REPO}
  --run-id <id>                   Reuse a known desktop-release run instead of locating it
  --workflow <file>               Workflow file, default: ${DEFAULT_WORKFLOW}
  --minimum-launcher-version <v>  Assert beta manifest minimumLauncherVersion
  --public-attempts <n>           Public Pages polling attempts, default: ${DEFAULT_PUBLIC_ATTEMPTS}
  --public-delay-ms <n>           Public Pages polling delay, default: ${DEFAULT_PUBLIC_DELAY_MS}
  --run-attempts <n>              Workflow polling attempts, default: ${DEFAULT_RUN_ATTEMPTS}
  --run-delay-ms <n>              Workflow polling delay, default: ${DEFAULT_RUN_DELAY_MS}
  --skip-public-pages             Verify gh-pages only; classify public Pages as intentionally skipped
  --help                          Show this help

What this verifies:
  1. release tag exists and is a prerelease
  2. desktop-release workflow finished successfully
  3. release assets exist on the GitHub release
  4. beta gh-pages manifest points at the runtime version
  5. public Pages manifest has propagated, unless skipped
`.trim());
}

function parseArgs(argv) {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const options = {
    channel: "beta",
    desktopVersion: null,
    minimumLauncherVersion: null,
    publicAttempts: DEFAULT_PUBLIC_ATTEMPTS,
    publicDelayMs: DEFAULT_PUBLIC_DELAY_MS,
    repo: DEFAULT_REPO,
    runAttempts: DEFAULT_RUN_ATTEMPTS,
    runDelayMs: DEFAULT_RUN_DELAY_MS,
    runId: null,
    runtimeVersion: null,
    skipPublicPages: false,
    tag: null,
    workflow: DEFAULT_WORKFLOW
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--desktop-version":
      case "--minimum-launcher-version":
      case "--repo":
      case "--run-id":
      case "--runtime-version":
      case "--tag":
      case "--workflow":
        options[toCamelCase(arg.slice(2))] = readValue(args, index, arg);
        index += 1;
        break;
      case "--public-attempts":
      case "--public-delay-ms":
      case "--run-attempts":
      case "--run-delay-ms":
        options[toCamelCase(arg.slice(2))] = readNumberValue(args, index, arg);
        index += 1;
        break;
      case "--skip-public-pages":
        options.skipPublicPages = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function readNumberValue(args, index, flag) {
  const value = Number(readValue(args, index, flag));
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`Invalid numeric value for ${flag}`);
  }
  return value;
}

function assertRequiredOptions(options) {
  const missing = [];
  for (const key of ["tag", "desktopVersion", "runtimeVersion"]) {
    if (!options[key]) {
      missing.push(`--${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required option(s): ${missing.join(", ")}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  assertRequiredOptions(options);
  await waitForDesktopReleaseClosure(options);
}

try {
  await main();
} catch (error) {
  console.error(`[desktop:beta:closure] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
