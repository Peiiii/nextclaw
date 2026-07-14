#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { verifyPublicRuntimeManifests } from "./release-runtime-manifest-verify.mjs";

const ROOT_DIR = process.cwd();
const REPO = "Peiiii/nextclaw";
const DEFAULT_CHANNEL = "beta";
const CHANNELS = new Set(["beta", "stable"]);
const RUNTIME_WORKFLOW = "npm-runtime-update-release.yml";
const RUNTIME_MANIFEST_TARGETS = [
  { platform: "darwin", arch: "arm64" },
  { platform: "darwin", arch: "x64" },
  { platform: "linux", arch: "x64" },
  { platform: "win32", arch: "x64" }
];

function printHelp() {
  console.log(`
Usage:
  pnpm release:beta:runtime -- [options]

Options:
  --channel <channel>                   Runtime update channel (beta or stable; default: beta)
  --dry-run                             Print the intended runtime-channel closure without mutating anything
  --branch <branch>                     Override the git branch used for workflow dispatch
  --version <version>                   Override the nextclaw version to publish to the runtime channel
  --release-tag <tag>                   Override the GitHub release tag used for runtime bundle assets
  --minimum-launcher-version-override <version>
                                        Recovery-only runtime manifest floor override
  --help                                Show this help

Default behavior:
  1. resolve the target nextclaw version (beta: nextclaw@beta, stable: nextclaw@latest)
  2. trigger npm-runtime-update-release for the selected channel
  3. wait for workflow success
  4. verify GitHub release assets
  5. verify gh-pages manifests and public channel manifests
`.trim());
}

function parseArgs(argv) {
  const normalizedArgv = argv.filter((arg) => arg !== "--");
  const options = {
    branch: null,
    channel: null,
    dryRun: false,
    help: false,
    minimumLauncherVersionOverride: null,
    releaseTag: null,
    version: null
  };

  for (let index = 0; index < normalizedArgv.length; index += 1) {
    const arg = normalizedArgv[index];
    switch (arg) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--branch":
        options.branch = normalizedArgv[index + 1] ?? null;
        index += 1;
        break;
      case "--channel":
        options.channel = normalizedArgv[index + 1] ?? null;
        index += 1;
        break;
      case "--version":
        options.version = normalizedArgv[index + 1] ?? null;
        index += 1;
        break;
      case "--release-tag":
        options.releaseTag = normalizedArgv[index + 1] ?? null;
        index += 1;
        break;
      case "--minimum-launcher-version-override":
        options.minimumLauncherVersionOverride = normalizedArgv[index + 1] ?? null;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function normalizeChannel(channel) {
  const normalized = (channel ?? DEFAULT_CHANNEL).trim().toLowerCase();
  if (!CHANNELS.has(normalized)) {
    throw new Error(`Unsupported runtime update channel: ${channel}`);
  }
  return normalized;
}

function run(command, args, options = {}) {
  const { capture = false, stdio = "inherit" } = options;
  return execFileSync(command, args, {
    cwd: ROOT_DIR,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : stdio
  });
}

function readJsonCommand(command, args) {
  const output = run(command, args, { capture: true });
  return JSON.parse(output);
}

function ensureCommandAvailable(command, args = ["--version"]) {
  try {
    run(command, args, { capture: true });
  } catch {
    throw new Error(`Required command is unavailable: ${command}`);
  }
}

function readCurrentBranch() {
  return run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { capture: true }).trim();
}

function readPublishedVersion(channel) {
  const packageSpec = channel === "beta" ? "nextclaw@beta" : "nextclaw@latest";
  return run("npm", ["view", packageSpec, "version"], { capture: true }).trim();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForWorkflowRun(branch, startedAtMs) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const runs = readJsonCommand("gh", [
      "run",
      "list",
      "--repo",
      REPO,
      "--workflow",
      RUNTIME_WORKFLOW,
      "--branch",
      branch,
      "--limit",
      "20",
      "--json",
      "databaseId,createdAt,event,headBranch,status,conclusion,url"
    ]);
    const matchingRun = runs.find((entry) => {
      const createdAtMs = Date.parse(entry.createdAt ?? "");
      return (
        entry.event === "workflow_dispatch" &&
        entry.headBranch === branch &&
        Number.isFinite(createdAtMs) &&
        createdAtMs >= startedAtMs - 60_000
      );
    });
    if (matchingRun) {
      return matchingRun;
    }
    await sleep(5000);
  }

  throw new Error(`Timed out waiting for ${RUNTIME_WORKFLOW} to appear on branch ${branch}.`);
}

function triggerRuntimeWorkflow({ branch, channel, minimumLauncherVersionOverride, releaseTag }) {
  const args = [
    "workflow",
    "run",
    RUNTIME_WORKFLOW,
    "--repo",
    REPO,
    "--ref",
    branch,
    "-f",
    `channel=${channel}`,
    "-f",
    `release_tag=${releaseTag}`
  ];
  if (minimumLauncherVersionOverride) {
    args.push("-f", `minimum_launcher_version_override=${minimumLauncherVersionOverride}`);
  }
  run("gh", args);
}

function watchWorkflowRun(runId) {
  run("gh", ["run", "watch", String(runId), "--repo", REPO, "--exit-status"]);
  const runSummary = readJsonCommand("gh", [
    "run",
    "view",
    String(runId),
    "--repo",
    REPO,
    "--json",
    "status,conclusion,url"
  ]);
  if (runSummary.status !== "completed" || runSummary.conclusion !== "success") {
    throw new Error(`Runtime workflow did not finish successfully: ${runSummary.url}`);
  }
  return runSummary;
}

function verifyRuntimeReleaseAssets(releaseTag, nextclawVersion) {
  const releaseSummary = readJsonCommand("gh", [
    "release",
    "view",
    releaseTag,
    "--repo",
    REPO,
    "--json",
    "url,assets"
  ]);
  const assetNames = new Set((releaseSummary.assets ?? []).map((asset) => asset.name));
  for (const target of RUNTIME_MANIFEST_TARGETS) {
    const expectedAssetName = `nextclaw-runtime-${target.platform}-${target.arch}-${nextclawVersion}.zip`;
    if (!assetNames.has(expectedAssetName)) {
      throw new Error(`Missing runtime bundle asset on release ${releaseTag}: ${expectedAssetName}`);
    }
  }
  return releaseSummary;
}

function buildDryRunPlan({ branch, channel, nextclawVersion, releaseTag, minimumLauncherVersionOverride }) {
  return [
    `- channel: ${channel}`,
    `- branch: ${branch}`,
    `- nextclaw version: ${nextclawVersion}`,
    `- release tag: ${releaseTag}`,
    minimumLauncherVersionOverride
      ? `- minimum launcher version override: ${minimumLauncherVersionOverride}`
      : "- minimum launcher version override: none",
    "- trigger npm-runtime-update-release workflow only",
    "- wait for workflow success",
    "- verify GitHub release assets",
    `- verify gh-pages manifests and public ${channel} manifests`
  ];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  ensureCommandAvailable("gh");
  ensureCommandAvailable("curl", ["--version"]);
  ensureCommandAvailable("npm", ["--version"]);

  const channel = normalizeChannel(options.channel);
  const branch = options.branch ?? readCurrentBranch();
  const nextclawVersion = options.version?.trim() || readPublishedVersion(channel);
  if (!nextclawVersion) {
    throw new Error(`Could not resolve the published nextclaw ${channel} version.`);
  }
  const releaseTag = options.releaseTag?.trim() || `nextclaw@${nextclawVersion}`;

  if (options.dryRun) {
    console.log(`release:${channel}:runtime dry run`);
    console.log(
      buildDryRunPlan({
        branch,
        channel,
        nextclawVersion,
        releaseTag,
        minimumLauncherVersionOverride: options.minimumLauncherVersionOverride
      }).join("\n")
    );
    return;
  }

  const dispatchStartedAtMs = Date.now();
  triggerRuntimeWorkflow({
    branch,
    channel,
    minimumLauncherVersionOverride: options.minimumLauncherVersionOverride,
    releaseTag
  });
  const workflowRun = await waitForWorkflowRun(branch, dispatchStartedAtMs);
  const runtimeRunSummary = watchWorkflowRun(workflowRun.databaseId);
  const runtimeReleaseSummary = verifyRuntimeReleaseAssets(releaseTag, nextclawVersion);
  const publicManifestSummary = await verifyPublicRuntimeManifests({
    channel,
    expectedVersion: nextclawVersion,
    readJsonCommand,
    repo: REPO,
    run,
    sleep,
    targets: RUNTIME_MANIFEST_TARGETS
  });

  console.log(`release:${channel}:runtime completed`);
  console.log(`- branch: ${branch}`);
  console.log(`- nextclaw version: ${nextclawVersion}`);
  console.log(`- runtime workflow: ${runtimeRunSummary.url}`);
  console.log(`- runtime release: ${runtimeReleaseSummary.url}`);
  console.log(`- runtime manifest verification: ${publicManifestSummary.source} (${publicManifestSummary.pagesStatus})`);
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error ? `[release:beta:runtime] ${error.message}` : "[release:beta:runtime] unknown error"
  );
  process.exit(1);
}
