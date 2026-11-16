import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dispatchDesktopWorkflowRun, readDesktopWorkflowRun } from "./desktop-release-github.mjs";

const ROOT_DIR = process.cwd();

function run(command, args) {
  const output = execFileSync(command, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return typeof output === "string" ? output.trim() : "";
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
  // GitHub's built-in token cannot create a release that restores an older
  // workflow tree. Freeze the validated source; recovery preserves old identities.
  return sourceCommit;
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

async function waitForWorkflowSuccess(options, runEntry, label) {
  const { repo, runAttempts, runDelayMs } = options;
  let previousLine = "";
  for (let attempt = 1; attempt <= runAttempts; attempt += 1) {
    const runSummary = await readDesktopWorkflowRun(repo, runEntry.databaseId);
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

  const { runId } = dispatchDesktopWorkflowRun({ repo, workflow: preflightWorkflow, branch, inputs: {
    channel, desktop_version: desktopVersion, runtime_version: runtimeVersion,
    minimum_launcher_version: minimumLauncherVersion, node_version: options.nodeVersion,
    target_sha: target, dispatch_id: `desktop-preflight-${randomUUID()}`
  }});
  await waitForPreflightSuccess(options, { databaseId: runId });
}
