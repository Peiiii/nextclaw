#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { waitForDesktopReleaseClosure } from "./desktop-release-closure.mjs";

const ROOT_DIR = process.cwd();
const DEFAULT_REPO = "Peiiii/nextclaw";
const DEFAULT_WORKFLOW = "desktop-release.yml";
const DEFAULT_PUBLIC_ATTEMPTS = 24;
const DEFAULT_PUBLIC_DELAY_MS = 10000;
const DEFAULT_RUN_ATTEMPTS = 150;
const DEFAULT_RUN_DELAY_MS = 10000;
const CHANNELS = new Set(["beta", "stable"]);

function printHelp() {
  console.log(`
Usage:
  pnpm release:desktop:beta -- [options]
  pnpm release:desktop:stable -- [options]
  node scripts/release/release-desktop.mjs --channel <beta|stable> [options]

Options:
  --channel <beta|stable>         Release channel. Provided by package scripts.
  --tag <tag>                     Override release tag. Defaults to next v<runtime>-desktop-beta.N or v<runtime>-desktop.N
  --desktop-version <version>     Override desktop app version. Defaults to apps/desktop/package.json
  --runtime-version <version>     Override runtime bundle version. Defaults to packages/nextclaw/package.json
  --minimum-launcher-version <v>  Override governed channel floor assertion
  --branch <branch>               Branch to push/dispatch from. Defaults to the current branch
  --repo <owner/repo>             GitHub repository. Defaults to ${DEFAULT_REPO}
  --workflow <file>               Desktop release workflow. Defaults to ${DEFAULT_WORKFLOW}
  --target <git-ref>              Release target. Defaults to HEAD
  --notes-file <path>             Release notes body file
  --run-id <id>                   Reuse a known desktop-release run
  --reuse-existing-release        Do not create the GitHub release; verify/close an existing tag
  --skip-local-verify             Skip pnpm desktop:package:verify
  --skip-public-pages             Verify gh-pages only; skip public Pages propagation polling
  --dry-run                       Print planned actions without mutating remote state
  --help                          Show this help
`.trim());
}

function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== "--");
  const options = {
    branch: null,
    channel: null,
    desktopVersion: null,
    dryRun: false,
    minimumLauncherVersion: null,
    notesFile: null,
    publicAttempts: DEFAULT_PUBLIC_ATTEMPTS,
    publicDelayMs: DEFAULT_PUBLIC_DELAY_MS,
    repo: DEFAULT_REPO,
    reuseExistingRelease: false,
    runAttempts: DEFAULT_RUN_ATTEMPTS,
    runDelayMs: DEFAULT_RUN_DELAY_MS,
    runId: null,
    runtimeVersion: null,
    skipLocalVerify: false,
    skipPublicPages: false,
    tag: null,
    target: "HEAD",
    workflow: DEFAULT_WORKFLOW
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--branch":
      case "--channel":
      case "--desktop-version":
      case "--minimum-launcher-version":
      case "--notes-file":
      case "--repo":
      case "--run-id":
      case "--runtime-version":
      case "--tag":
      case "--target":
      case "--workflow":
        options[toCamelCase(arg.slice(2))] = readValue(args, index, arg);
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--reuse-existing-release":
        options.reuseExistingRelease = true;
        break;
      case "--skip-local-verify":
        options.skipLocalVerify = true;
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

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"]
  });
  return typeof output === "string" ? output.trim() : "";
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(resolve(ROOT_DIR, path), "utf8"));
}

function readPackageVersion(path) {
  const version = readJsonFile(path).version;
  if (typeof version !== "string" || !version.trim()) {
    throw new Error(`Missing package version in ${path}`);
  }
  return version.trim();
}

function assertOptions(options) {
  if (!CHANNELS.has(options.channel)) {
    throw new Error("--channel must be beta or stable.");
  }
}

function readCurrentBranch() {
  return run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
}

function readWorktreeStatus() {
  return run("git", ["status", "--short"]);
}

function assertCleanWorktree(options) {
  const status = readWorktreeStatus();
  if (status) {
    if (options.dryRun) {
      console.warn("[desktop:release] dry-run continuing with a dirty worktree.");
      return;
    }
    throw new Error("Desktop release requires a clean worktree. Commit or stash local changes first.");
  }
}

function ensureRequiredCommands() {
  run("git", ["--version"]);
  run("gh", ["--version"]);
  run("pnpm", ["--version"]);
  run("curl", ["--version"]);
}

function fetchReleaseRefs(branch) {
  run("git", ["-c", "gc.auto=0", "fetch", "origin", branch, "--no-tags", "--quiet"]);
}

function assertBranchIsNotBehind(branch) {
  const upstreamRef = `origin/${branch}`;
  try {
    run("git", ["rev-parse", "--verify", "--quiet", upstreamRef]);
  } catch {
    throw new Error(`Upstream branch does not exist: ${upstreamRef}`);
  }
  const counts = run("git", ["rev-list", "--left-right", "--count", `HEAD...${upstreamRef}`])
    .split(/\s+/)
    .map((value) => Number(value));
  const [ahead, behind] = counts;
  if (behind > 0) {
    throw new Error(`Current branch is behind ${upstreamRef} by ${behind} commit(s). Pull/rebase first.`);
  }
  return ahead;
}

function readMinimumLauncherVersion(channel) {
  const config = readJsonFile("apps/desktop/desktop-launcher-compatibility.json");
  const value = config?.[channel]?.minimumLauncherVersion;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing minimumLauncherVersion for ${channel}.`);
  }
  return value.trim();
}

function buildTagPrefix(channel, runtimeVersion) {
  return channel === "beta"
    ? `v${runtimeVersion}-desktop-beta.`
    : `v${runtimeVersion}-desktop.`;
}

function readNextTag(channel, runtimeVersion) {
  const prefix = buildTagPrefix(channel, runtimeVersion);
  const output = run("git", ["ls-remote", "--tags", "origin", `refs/tags/${prefix}*`]);
  const nextNumber = output
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[1] ?? "")
    .map((ref) => ref.replace(/^refs\/tags\//, "").replace(/\^\{\}$/, ""))
    .map((tag) => Number(tag.startsWith(prefix) ? tag.slice(prefix.length) : NaN))
    .filter(Number.isInteger)
    .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `${prefix}${nextNumber}`;
}

function buildReleaseTitle(options) {
  const { channel, desktopVersion, tag } = options;
  const suffix = Number(tag.split(".").at(-1));
  if (channel === "beta") {
    return `NextClaw Desktop ${desktopVersion} Preview Beta ${Number.isInteger(suffix) ? suffix : ""}`.trim();
  }
  return `NextClaw Desktop ${desktopVersion}`;
}

function buildReleaseNotes(options) {
  const { channel, desktopVersion, minimumLauncherVersion, notesFile, runtimeVersion } = options;
  if (notesFile) {
    return readFileSync(resolve(ROOT_DIR, notesFile), "utf8");
  }

  if (channel === "beta") {
    return [
      `NextClaw Desktop preview build for runtime ${runtimeVersion}.`,
      "",
      "- Includes desktop installers, portable Windows builds, update bundles, and beta update manifests.",
      `- Desktop app version: ${desktopVersion}`,
      `- Runtime bundle version: ${runtimeVersion}`,
      `- Minimum launcher version: ${minimumLauncherVersion}`
    ].join("\n");
  }

  return [
    "English Version",
    "",
    `NextClaw Desktop ${desktopVersion} stable release for runtime ${runtimeVersion}.`,
    "",
    "- Includes desktop installers, update bundles, stable update manifests, and Linux APT publishing.",
    `- Minimum launcher version: ${minimumLauncherVersion}`,
    "",
    "中文版",
    "",
    `NextClaw Desktop ${desktopVersion} 正式版，运行时版本 ${runtimeVersion}。`,
    "",
    "- 包含桌面安装包、更新包、stable 更新 manifest 与 Linux APT 发布。",
    `- 最低 launcher 版本：${minimumLauncherVersion}`
  ].join("\n");
}

function runLocalVerify(options) {
  if (options.skipLocalVerify) {
    console.log("[desktop:release] local package verification skipped by flag.");
    return;
  }
  run("pnpm", ["desktop:package:verify"], {
    capture: false,
    env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH ?? ""}` }
  });
}

function pushBranchIfNeeded(branch, aheadCount, options) {
  if (aheadCount === 0) {
    return;
  }
  const message = `[desktop:release] pushing ${aheadCount} local commit(s) to origin/${branch}`;
  if (options.dryRun) {
    console.log(`${message} (dry-run)`);
    return;
  }
  console.log(message);
  run("git", ["push", "origin", `HEAD:${branch}`], { capture: false });
}

function createRelease(options) {
  const { channel, dryRun, repo, tag, target } = options;
  const args = [
    "release",
    "create",
    tag,
    "--repo",
    repo,
    "--target",
    target,
    "--title",
    buildReleaseTitle(options),
    "--notes",
    buildReleaseNotes(options)
  ];
  if (channel === "beta") {
    args.push("--prerelease");
  }

  if (dryRun) {
    console.log(`[desktop:release] would create GitHub ${channel} release ${tag}`);
    return;
  }
  run("gh", args, { capture: false });
}

function printPlan(options, aheadCount) {
  const { branch, channel, desktopVersion, minimumLauncherVersion, runtimeVersion, tag, target } = options;
  console.log(
    [
      `[desktop:release] channel=${channel}`,
      `tag=${tag}`,
      `desktopVersion=${desktopVersion}`,
      `runtimeVersion=${runtimeVersion}`,
      `minimumLauncherVersion=${minimumLauncherVersion}`,
      `branch=${branch}`,
      `target=${target}`,
      `ahead=${aheadCount}`
    ].join(" ")
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  assertOptions(options);
  ensureRequiredCommands();
  assertCleanWorktree(options);

  options.branch ??= readCurrentBranch();
  options.desktopVersion ??= readPackageVersion("apps/desktop/package.json");
  options.runtimeVersion ??= readPackageVersion("packages/nextclaw/package.json");
  options.minimumLauncherVersion ??= readMinimumLauncherVersion(options.channel);
  options.tag ??= readNextTag(options.channel, options.runtimeVersion);

  fetchReleaseRefs(options.branch);
  const aheadCount = assertBranchIsNotBehind(options.branch);
  printPlan(options, aheadCount);

  if (options.dryRun) {
    console.log("[desktop:release] dry-run complete; no release was created.");
    return;
  }

  runLocalVerify(options);
  pushBranchIfNeeded(options.branch, aheadCount, options);
  if (!options.reuseExistingRelease) {
    createRelease(options);
  }
  await waitForDesktopReleaseClosure(options);
}

try {
  await main();
} catch (error) {
  console.error(`[desktop:release] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
