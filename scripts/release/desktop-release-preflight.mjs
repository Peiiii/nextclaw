import { execFileSync } from "node:child_process";

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

function findWorkflowDispatchRun(options) {
  const { branch, preflightWorkflow, repo, target } = options;
  const runs = readJsonCommand("gh", [
    "run",
    "list",
    "--repo",
    repo,
    "--workflow",
    preflightWorkflow,
    "--event",
    "workflow_dispatch",
    "--branch",
    branch,
    "--limit",
    "20",
    "--json",
    "databaseId,headSha,status,conclusion,url"
  ]);
  return runs.find((entry) => entry.headSha === target);
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
  const { repo, runAttempts, runDelayMs } = options;
  let previousLine = "";
  for (let attempt = 1; attempt <= runAttempts; attempt += 1) {
    const runSummary = readWorkflowRun(repo, runEntry.databaseId);
    const line = `[desktop:release] preflight ${runEntry.databaseId}: ${runSummary.status}/${runSummary.conclusion || "pending"}`;
    if (line !== previousLine) {
      console.log(line);
      previousLine = line;
    }
    if (runSummary.status === "completed") {
      if (runSummary.conclusion !== "success") {
        throw new Error(`Desktop release preflight failed: ${runSummary.url}`);
      }
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, runDelayMs));
  }
  throw new Error(`Timed out waiting for desktop release preflight: ${runEntry.url}`);
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
    `target_sha=${target}`
  ]);
  const runEntry = await waitForPreflightRun(options);
  await waitForPreflightSuccess(options, runEntry);
}
