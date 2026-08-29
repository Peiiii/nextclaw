#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPublicRuntimeManifests } from "./release-runtime-manifest-verify.mjs";
import { readCoreReleaseNotes } from "./release-core-notes.mjs";
import {
  PREPARED_NPM_WORKFLOW,
  selectPreparedNpmWorkflowRun,
} from "./prepared-npm-release-artifact.mjs";

const ROOT_DIR = process.cwd();
const REPO = "Peiiii/nextclaw";
const CHANNELS = new Set(["beta", "stable"]);
const RUNTIME_WORKFLOW = "npm-runtime-update-release.yml";
const RUNTIME_MANIFEST_TARGETS = [
  { platform: "darwin", arch: "arm64" },
  { platform: "darwin", arch: "x64" },
  { platform: "linux", arch: "x64" },
  { platform: "win32", arch: "x64" },
];

function printHelp() {
  console.log(
    `
Usage:
  pnpm release:beta:runtime -- [options]

Options:
  --channel <channel>                   Runtime update channel (beta or stable; default: beta)
  --dry-run                             Print the intended runtime-channel closure without mutating anything
  --branch <branch>                     Override the git branch used for workflow dispatch
  --version <version>                   Override the nextclaw version to publish to the runtime channel
  --release-tag <tag>                   Override the GitHub release tag used for runtime bundle assets
  --prepared-source-sha <sha>           Require and promote Runtime artifacts from this exact prepared source
  --minimum-launcher-version-override <version>
                                        Recovery-only runtime manifest floor override
  --help                                Show this help

Default behavior:
  1. resolve the target nextclaw version (beta: nextclaw@beta, stable: nextclaw@latest)
  2. trigger npm-runtime-update-release for the selected channel
  3. wait for workflow success
  4. verify GitHub release metadata, assets, gh-pages manifests, and public channel manifests
`.trim(),
  );
}

function parseArgs(argv) {
  const normalizedArgv = argv.filter((arg) => arg !== "--");
  const options = {
    branch: null,
    channel: null,
    dryRun: false,
    help: false,
    minimumLauncherVersionOverride: null,
    preparedSourceSha: null,
    releaseTag: null,
    version: null,
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
      case "--prepared-source-sha":
        options.preparedSourceSha = normalizedArgv[index + 1] ?? null;
        index += 1;
        break;
      case "--minimum-launcher-version-override":
        options.minimumLauncherVersionOverride =
          normalizedArgv[index + 1] ?? null;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function normalizeChannel(channel) {
  const normalized = (channel ?? "beta").trim().toLowerCase();
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
    stdio: capture ? ["ignore", "pipe", "pipe"] : stdio,
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
  return run("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    capture: true,
  }).trim();
}

function readHeadSha() {
  return run("git", ["rev-parse", "HEAD"], { capture: true }).trim();
}

function readPublishedVersion(channel) {
  const packageSpec = channel === "beta" ? "nextclaw@beta" : "nextclaw@latest";
  return run("npm", ["view", packageSpec, "version"], { capture: true }).trim();
}

function readStableReleaseNotesUrl(nextclawVersion) {
  return readCoreReleaseNotes(ROOT_DIR, nextclawVersion, REPO).releaseNotesUrl;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function selectRuntimeWorkflowRun(runs, dispatchId, startedAtMs) {
  return runs.find((entry) => {
    const createdAtMs = Date.parse(entry.createdAt ?? "");
    return (
      entry.event === "workflow_dispatch" &&
      String(entry.displayTitle ?? "").includes(`dispatch=${dispatchId}`) &&
      Number.isFinite(createdAtMs) &&
      createdAtMs >= startedAtMs - 60_000
    );
  });
}

async function waitForWorkflowRun(dispatchId, startedAtMs) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const runs = readJsonCommand("gh", [
      "run",
      "list",
      "--repo",
      REPO,
      "--workflow",
      RUNTIME_WORKFLOW,
      "--limit",
      "20",
      "--json",
      "databaseId,createdAt,displayTitle,event,headSha,status,conclusion,url",
    ]);
    const matchingRun = selectRuntimeWorkflowRun(runs, dispatchId, startedAtMs);
    if (matchingRun) {
      return matchingRun;
    }
    await sleep(5000);
  }

  throw new Error(
    `Timed out waiting for ${RUNTIME_WORKFLOW} dispatch ${dispatchId}.`,
  );
}

function triggerRuntimeWorkflow({
  branch,
  channel,
  minimumLauncherVersionOverride,
  releaseTag,
  releaseTarget,
  dispatchId,
  preparedRunId,
  preparedSourceSha,
}) {
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
    `release_tag=${releaseTag}`,
    "-f",
    `release_target=${releaseTarget}`,
    "-f",
    `dispatch_id=${dispatchId}`,
  ];
  if (preparedRunId) {
    args.push("-f", `prepared_run_id=${preparedRunId}`);
  }
  if (preparedSourceSha) {
    args.push("-f", `prepared_source_sha=${preparedSourceSha}`);
  }
  if (minimumLauncherVersionOverride) {
    args.push(
      "-f",
      `minimum_launcher_version_override=${minimumLauncherVersionOverride}`,
    );
  }
  run("gh", args);
}

export function selectPreparedRuntimeWorkflowRun(runs, sourceCommit) {
  return selectPreparedNpmWorkflowRun(runs, sourceCommit);
}

function resolvePreparedRuntimeWorkflowRun(sourceCommit) {
  if (!sourceCommit) return null;
  const runs = readJsonCommand("gh", [
    "run",
    "list",
    "--repo",
    REPO,
    "--workflow",
    PREPARED_NPM_WORKFLOW,
    "--limit",
    "50",
    "--json",
    "databaseId,createdAt,displayTitle,event,headSha,status,conclusion,url",
  ]);
  const runEntry = selectPreparedRuntimeWorkflowRun(runs, sourceCommit);
  if (!runEntry) {
    throw new Error(
      `Stable Runtime promotion requires a successful ${PREPARED_NPM_WORKFLOW} run for exact source ${sourceCommit}.`,
    );
  }
  return runEntry;
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
    "status,conclusion,url",
  ]);
  if (
    runSummary.status !== "completed" ||
    runSummary.conclusion !== "success"
  ) {
    throw new Error(
      `Runtime workflow did not finish successfully: ${runSummary.url}`,
    );
  }
  return runSummary;
}

async function dispatchAndWaitRuntimeWorkflow(options) {
  const dispatchStartedAtMs = Date.now();
  const dispatchId = `npm-runtime-${randomUUID()}`;
  triggerRuntimeWorkflow({ ...options, dispatchId });
  const workflowRun = await waitForWorkflowRun(dispatchId, dispatchStartedAtMs);
  return watchWorkflowRun(workflowRun.databaseId);
}

function verifyRuntimeReleaseAssets(releaseTag, nextclawVersion, channel) {
  const releaseSummary = readJsonCommand("gh", [
    "release",
    "view",
    releaseTag,
    "--repo",
    REPO,
    "--json",
    "url,isPrerelease,assets",
  ]);
  if (releaseSummary.isPrerelease !== (channel === "beta")) {
    throw new Error(
      `GitHub release prerelease flag does not match the ${channel} channel: ${releaseSummary.url}`,
    );
  }
  const assetNames = new Set(
    (releaseSummary.assets ?? []).map((asset) => asset.name),
  );
  for (const target of RUNTIME_MANIFEST_TARGETS) {
    const expectedAssetName = `nextclaw-runtime-${target.platform}-${target.arch}-${nextclawVersion}.zip`;
    if (!assetNames.has(expectedAssetName)) {
      throw new Error(
        `Missing runtime bundle asset on release ${releaseTag}: ${expectedAssetName}`,
      );
    }
  }
  return releaseSummary;
}

function buildDryRunPlan({
  branch,
  channel,
  nextclawVersion,
  releaseTag,
  minimumLauncherVersionOverride,
  preparedSourceSha,
}) {
  return [
    `- channel: ${channel}`,
    `- branch: ${branch}`,
    `- nextclaw version: ${nextclawVersion}`,
    `- release tag: ${releaseTag}`,
    minimumLauncherVersionOverride
      ? `- minimum launcher version override: ${minimumLauncherVersionOverride}`
      : "- minimum launcher version override: none",
    preparedSourceSha
      ? `- prepared Runtime source: ${preparedSourceSha}`
      : "- prepared Runtime source: cold-build fallback",
    "- trigger npm-runtime-update-release workflow only",
    "- wait for workflow success",
    `- verify GitHub release metadata, assets, gh-pages manifests, and public ${channel} manifests`,
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
  const releaseTarget = readHeadSha();
  const nextclawVersion =
    options.version?.trim() || readPublishedVersion(channel);
  if (!nextclawVersion) {
    throw new Error(
      `Could not resolve the published nextclaw ${channel} version.`,
    );
  }
  const releaseTag =
    options.releaseTag?.trim() || `nextclaw@${nextclawVersion}`;
  const expectedReleaseNotesUrl =
    channel === "stable" ? readStableReleaseNotesUrl(nextclawVersion) : null;
  const preparedSourceSha = options.preparedSourceSha?.trim() || null;

  if (options.dryRun) {
    console.log(`release:${channel}:runtime dry run`);
    console.log(
      buildDryRunPlan({
        branch,
        channel,
        nextclawVersion,
        releaseTag,
        minimumLauncherVersionOverride: options.minimumLauncherVersionOverride,
        preparedSourceSha,
      }).join("\n"),
    );
    return;
  }

  const preparedRun = resolvePreparedRuntimeWorkflowRun(preparedSourceSha);

  const runtimeRunSummary = await dispatchAndWaitRuntimeWorkflow({
    branch,
    channel,
    minimumLauncherVersionOverride: options.minimumLauncherVersionOverride,
    releaseTag,
    releaseTarget,
    preparedRunId: preparedRun?.databaseId ?? null,
    preparedSourceSha,
  });
  const runtimeReleaseSummary = verifyRuntimeReleaseAssets(
    releaseTag,
    nextclawVersion,
    channel,
  );
  const publicManifestSummary = await verifyPublicRuntimeManifests({
    channel,
    expectedReleaseNotesUrl,
    expectedVersion: nextclawVersion,
    readJsonCommand,
    repo: REPO,
    run,
    sleep,
    targets: RUNTIME_MANIFEST_TARGETS,
  });

  console.log(`release:${channel}:runtime completed`);
  console.log(`- branch: ${branch}`);
  console.log(`- nextclaw version: ${nextclawVersion}`);
  console.log(`- runtime workflow: ${runtimeRunSummary.url}`);
  console.log(`- runtime release: ${runtimeReleaseSummary.url}`);
  console.log(
    `- runtime manifest verification: ${publicManifestSummary.source} (${publicManifestSummary.pagesStatus})`,
  );
}

if (
  !process.env.NODE_TEST_CONTEXT &&
  resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? `[release:beta:runtime] ${error.message}`
        : "[release:beta:runtime] unknown error",
    );
    process.exit(1);
  }
}
