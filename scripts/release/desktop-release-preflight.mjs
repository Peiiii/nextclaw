import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const ROOT_DIR = process.cwd();

function run(command, args) {
  const output = execFileSync(command, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return typeof output === "string" ? output.trim() : "";
}

function readJsonCommand(command, args) {
  return JSON.parse(run(command, args));
}

function blockingSleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function resolveDesktopReleaseTarget(publishedCommit, sourceCommit, options = {}) {
  const runCommand = options.runCommand ?? run;
  runCommand("git", ["merge-base", "--is-ancestor", publishedCommit, sourceCommit]);
  const paths = runCommand("git", ["diff", "--name-only", publishedCommit, sourceCommit])
    .split("\n").filter(Boolean);
  const allowed = /^(apps\/(desktop|docs)\/|scripts\/(desktop|release)\/|\.github\/workflows\/|\.agents\/|docs\/|commands\/|AGENTS\.md$|CLAUDE\.md$)/;
  const runtimeChanges = paths.filter((path) => !allowed.test(path));
  if (runtimeChanges.length > 0) {
    throw new Error(`Desktop recovery cannot include unpublished runtime changes: ${runtimeChanges.join(", ")}`);
  }
  if (!paths.some((path) => /^(apps\/desktop|scripts\/desktop)\//.test(path))) return publishedCommit;
  return runCommand("git", ["log", "-1", "--format=%H", sourceCommit, "--", "apps/desktop", "scripts/desktop"]);
}

export function assertPublishedDesktopRuntimeIdentity(channel, runtimeVersion, options = {}) {
  const distTag = channel === "beta" ? "beta" : "latest";
  const runCommand = options.runCommand ?? run;
  const sleep = options.sleep ?? blockingSleep;
  const attempts = options.attempts ?? 6;
  let exactVersion = null;
  let channelVersion = null;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastError = null;
    try {
      exactVersion = runCommand("npm", ["view", `nextclaw@${runtimeVersion}`, "version"]);
      channelVersion = runCommand("npm", ["view", `nextclaw@${distTag}`, "version"]);
    } catch (error) {
      lastError = error;
    }
    if (exactVersion === runtimeVersion && channelVersion === runtimeVersion) return;
    if (attempt < attempts) sleep(2000 * attempt);
  }
  if (lastError) {
    throw new Error(
      `Could not confirm published NPM identity after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }
  throw new Error(
    `Desktop release requires an already published nextclaw ${channel} identity after ${attempts} attempts: exact=${exactVersion || "<missing>"}, ${distTag}=${channelVersion || "<missing>"}, expected=${runtimeVersion}. Publish the NPM/runtime version first; desktop release never republishes NPM.`
  );
}

function readWorkflowRun(repo, runId) {
  return readJsonCommand("gh", [
    "run",
    "view",
    String(runId),
    "--repo",
    repo,
    "--json",
    "databaseId,status,conclusion,url,jobs,headSha"
  ]);
}

export function selectPreflightWorkflowRun(runs, dispatchId, startedAt = 0) {
  return runs.find(
    (entry) =>
      String(entry.displayTitle ?? "").includes(`dispatch=${dispatchId}`) &&
      Date.parse(entry.createdAt ?? "") >= startedAt - 60_000
  );
}

function findWorkflowDispatchRun(options) {
  const { dispatchId, dispatchStartedAt, preflightWorkflow, repo } = options;
  const runs = readJsonCommand("gh", [
    "run",
    "list",
    "--repo",
    repo,
    "--workflow",
    preflightWorkflow,
    "--event",
    "workflow_dispatch",
    "--limit",
    "20",
    "--json",
    "databaseId,createdAt,displayTitle,headSha,status,conclusion,url"
  ]);
  return selectPreflightWorkflowRun(runs, dispatchId, dispatchStartedAt);
}

async function waitForWorkflowSuccess(options, runEntry, label) {
  const { repo, runAttempts, runDelayMs } = options;
  let previousLine = "";
  for (let attempt = 1; attempt <= runAttempts; attempt += 1) {
    const runSummary = readWorkflowRun(repo, runEntry.databaseId);
    const line = `[desktop:release] ${label} ${runEntry.databaseId}: ${runSummary.status}/${runSummary.conclusion || "pending"}`;
    if (line !== previousLine) {
      console.log(line);
      previousLine = line;
    }
    if (runSummary.status === "completed") {
      if (runSummary.conclusion !== "success") {
        throw new Error(`Desktop ${label} failed: ${runSummary.url}`);
      }
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, runDelayMs));
  }
  throw new Error(`Timed out waiting for desktop ${label}: ${runEntry.url}`);
}

async function waitForPreflightRun(options) {
  const { preflightWorkflow, target } = options;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const runEntry = findWorkflowDispatchRun(options);
    if (runEntry) {
      return runEntry;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5000));
  }
  throw new Error(`Timed out locating ${preflightWorkflow} run for ${target}.`);
}

async function waitForPreflightSuccess(options, runEntry) {
  await waitForWorkflowSuccess(options, runEntry, "preflight");
}

export async function runRemotePreflight(options) {
  const {
    branch,
    channel,
    desktopVersion,
    dryRun,
    minimumLauncherVersion,
    preflightWorkflow,
    repo,
    runtimeVersion,
    skipRemotePreflight,
    target
  } = options;
  if (skipRemotePreflight) {
    console.log("[desktop:release] remote signing preflight skipped by flag.");
    return;
  }
  if (dryRun) {
    console.log(`[desktop:release] would run ${preflightWorkflow} for ${target}`);
    return;
  }

  const dispatchId = `desktop-preflight-${randomUUID()}`;
  const dispatchStartedAt = Date.now();

  run("gh", [
    "workflow",
    "run",
    preflightWorkflow,
    "--repo",
    repo,
    "--ref",
    branch,
    "-f",
    `channel=${channel}`,
    "-f",
    `desktop_version=${desktopVersion}`,
    "-f",
    `runtime_version=${runtimeVersion}`,
    "-f",
    `minimum_launcher_version=${minimumLauncherVersion}`,
    "-f",
    `node_version=${options.nodeVersion}`,
    "-f",
    `target_sha=${target}`,
    "-f",
    `dispatch_id=${dispatchId}`
  ]);
  const runEntry = await waitForPreflightRun({ ...options, dispatchId, dispatchStartedAt });
  await waitForPreflightSuccess(options, runEntry);
}
