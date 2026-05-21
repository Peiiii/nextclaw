#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

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
  3. Windows portable assets exist on the GitHub release
  4. beta gh-pages manifest points at the runtime version
  5. public Pages manifest has propagated, unless skipped
`.trim());
}

function parseArgs(argv) {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const options = {
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
        options.desktopVersion = readValue(args, index, arg);
        index += 1;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--minimum-launcher-version":
        options.minimumLauncherVersion = readValue(args, index, arg);
        index += 1;
        break;
      case "--public-attempts":
        options.publicAttempts = readNumberValue(args, index, arg);
        index += 1;
        break;
      case "--public-delay-ms":
        options.publicDelayMs = readNumberValue(args, index, arg);
        index += 1;
        break;
      case "--repo":
        options.repo = readValue(args, index, arg);
        index += 1;
        break;
      case "--run-attempts":
        options.runAttempts = readNumberValue(args, index, arg);
        index += 1;
        break;
      case "--run-delay-ms":
        options.runDelayMs = readNumberValue(args, index, arg);
        index += 1;
        break;
      case "--run-id":
        options.runId = readValue(args, index, arg);
        index += 1;
        break;
      case "--runtime-version":
        options.runtimeVersion = readValue(args, index, arg);
        index += 1;
        break;
      case "--skip-public-pages":
        options.skipPublicPages = true;
        break;
      case "--tag":
        options.tag = readValue(args, index, arg);
        index += 1;
        break;
      case "--workflow":
        options.workflow = readValue(args, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
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

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"]
  });
  return typeof output === "string" ? output.trim() : "";
}

function readJson(command, args) {
  return JSON.parse(run(command, args));
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

function readTagSha(tag) {
  const output = run("git", ["ls-remote", "origin", `refs/tags/${tag}`]);
  const [sha] = output.split(/\s+/);
  if (!sha) {
    throw new Error(`Tag does not exist on origin: ${tag}`);
  }
  return sha;
}

async function waitForWorkflowRun(options, tagSha) {
  if (options.runId) {
    return readWorkflowRun(options.repo, options.runId);
  }

  for (let attempt = 1; attempt <= 24; attempt += 1) {
    const runs = readJson("gh", [
      "run",
      "list",
      "--repo",
      options.repo,
      "--workflow",
      options.workflow,
      "--event",
      "release",
      "--limit",
      "30",
      "--json",
      "databaseId,displayTitle,headSha,status,conclusion,url"
    ]);
    const runEntry = runs.find(
      (entry) =>
        entry.headSha === tagSha ||
        String(entry.displayTitle ?? "").includes(options.tag) ||
        String(entry.displayTitle ?? "").includes(options.runtimeVersion)
    );
    if (runEntry) {
      return runEntry;
    }
    await sleep(5000);
  }

  throw new Error(`Timed out locating ${options.workflow} release run for ${options.tag}.`);
}

function readWorkflowRun(repo, runId) {
  return readJson("gh", [
    "run",
    "view",
    String(runId),
    "--repo",
    repo,
    "--json",
    "databaseId,status,conclusion,url,jobs,headSha"
  ]);
}

function summarizeJobs(runSummary) {
  const jobs = runSummary.jobs ?? [];
  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.conclusion && job.conclusion !== "success" && job.conclusion !== "skipped");
  const important = jobs
    .filter((job) =>
      [
        "desktop-win32-x64",
        "desktop-win32-arm64",
        "publish-release-assets",
        "publish-desktop-update-channels",
        "publish-linux-apt-repo"
      ].includes(job.name)
    )
    .map((job) => `${job.name}:${job.status}/${job.conclusion || "pending"}`)
    .join(", ");
  return { completed, failed, important, total: jobs.length };
}

async function waitForWorkflowSuccess(options, runEntry) {
  let previousLine = "";
  const runId = runEntry.databaseId ?? runEntry.id ?? options.runId;

  for (let attempt = 1; attempt <= options.runAttempts; attempt += 1) {
    const runSummary = readWorkflowRun(options.repo, runId);
    const jobSummary = summarizeJobs(runSummary);
    const line = `[desktop:beta:closure] run ${runId}: ${runSummary.status}/${runSummary.conclusion || "pending"} jobs ${jobSummary.completed}/${jobSummary.total} ${jobSummary.important}`;
    if (line !== previousLine) {
      console.log(line);
      previousLine = line;
    }

    if (jobSummary.failed.length > 0) {
      for (const job of jobSummary.failed) {
        console.error(`[desktop:beta:closure] failed job: ${job.name} ${job.url ?? ""}`);
      }
      throw new Error(`Workflow has failed jobs: ${runSummary.url}`);
    }

    if (runSummary.status === "completed") {
      if (runSummary.conclusion !== "success") {
        throw new Error(`Workflow did not finish successfully: ${runSummary.url}`);
      }
      return runSummary;
    }

    await sleep(options.runDelayMs);
  }

  throw new Error(`Timed out waiting for workflow success: ${runEntry.url ?? runId}`);
}

function verifyReleaseAssets(options) {
  const release = readJson("gh", [
    "release",
    "view",
    options.tag,
    "--repo",
    options.repo,
    "--json",
    "assets,isPrerelease,tagName,url,targetCommitish"
  ]);
  if (!release.isPrerelease) {
    throw new Error(`Expected a prerelease, got a normal release: ${release.url}`);
  }

  const assetNames = new Set((release.assets ?? []).map((asset) => asset.name));
  const expectedAssets = [
    `NextClaw-Portable-${options.desktopVersion}-win-x64.zip`,
    `NextClaw-Portable-${options.desktopVersion}-win-arm64.zip`,
    `NextClaw.Desktop-Setup-${options.desktopVersion}-x64.exe`,
    `nextclaw-bundle-win32-x64-${options.runtimeVersion}.zip`,
    `manifest-beta-win32-x64.json`,
    `update-bundle-public.pem`
  ];

  const missingAssets = expectedAssets.filter((assetName) => !assetNames.has(assetName));
  if (missingAssets.length > 0) {
    throw new Error(`Missing release assets on ${options.tag}: ${missingAssets.join(", ")}`);
  }

  console.log(`[desktop:beta:closure] release assets OK: ${expectedAssets.join(", ")}`);
  return release;
}

function readGhPagesManifest() {
  run("git", ["fetch", "origin", "gh-pages", "--quiet"]);
  return JSON.parse(
    run("git", ["show", "origin/gh-pages:desktop-updates/beta/manifest-beta-win32-x64.json"])
  );
}

function assertManifest(manifest, options, label) {
  if (manifest.latestVersion !== options.runtimeVersion) {
    throw new Error(
      `${label} latestVersion mismatch: expected ${options.runtimeVersion}, got ${manifest.latestVersion}`
    );
  }
  if (
    options.minimumLauncherVersion &&
    manifest.minimumLauncherVersion !== options.minimumLauncherVersion
  ) {
    throw new Error(
      `${label} minimumLauncherVersion mismatch: expected ${options.minimumLauncherVersion}, got ${manifest.minimumLauncherVersion}`
    );
  }
}

async function waitForPublicManifest(options) {
  if (options.skipPublicPages) {
    console.log("[desktop:beta:closure] public Pages verification skipped by flag.");
    return;
  }

  const manifestUrl =
    "https://peiiii.github.io/nextclaw/desktop-updates/beta/manifest-beta-win32-x64.json";
  for (let attempt = 1; attempt <= options.publicAttempts; attempt += 1) {
    const manifest = readJson("curl", [
      "-fsSL",
      `${manifestUrl}?desktopBetaClosure=${Date.now()}-${attempt}`
    ]);
    if (manifest.latestVersion === options.runtimeVersion) {
      assertManifest(manifest, options, "public Pages manifest");
      console.log(`[desktop:beta:closure] public Pages manifest OK: ${manifest.latestVersion}`);
      return;
    }
    console.warn(
      `[desktop:beta:closure] public Pages attempt ${attempt}/${options.publicAttempts}: still ${manifest.latestVersion}`
    );
    if (attempt < options.publicAttempts) {
      await sleep(options.publicDelayMs);
    }
  }

  throw new Error(
    `Public Pages manifest did not propagate to ${options.runtimeVersion} after ${options.publicAttempts} attempts.`
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  assertRequiredOptions(options);

  const tagSha = readTagSha(options.tag);
  console.log(`[desktop:beta:closure] tag: ${options.tag} ${tagSha}`);

  const runEntry = await waitForWorkflowRun(options, tagSha);
  await waitForWorkflowSuccess(options, runEntry);
  verifyReleaseAssets(options);

  const ghPagesManifest = readGhPagesManifest();
  assertManifest(ghPagesManifest, options, "gh-pages manifest");
  console.log(`[desktop:beta:closure] gh-pages manifest OK: ${ghPagesManifest.latestVersion}`);

  await waitForPublicManifest(options);
  console.log(`[desktop:beta:closure] complete: ${options.tag}`);
}

try {
  await main();
} catch (error) {
  console.error(`[desktop:beta:closure] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
