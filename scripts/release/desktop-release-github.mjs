import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT_DIR = process.cwd();

function runGh(args, options = {}) {
  const output = execFileSync("gh", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    input: options.input,
    timeout: options.timeout,
    stdio: options.capture === false ? "inherit" : [options.input ? "pipe" : "ignore", "pipe", "pipe"]
  });
  return typeof output === "string" ? output.trim() : "";
}

function buildReleaseTitle(options) {
  const { channel, desktopVersion, tag } = options;
  const suffix = Number(tag.split(".").at(-1));
  if (channel === "beta") {
    return `NextClaw Desktop ${desktopVersion} Preview Beta ${Number.isInteger(suffix) ? suffix : ""}`.trim();
  }
  return `NextClaw Desktop ${desktopVersion}`;
}

export function readRelease(options) {
  const { repo, tag } = options;
  return JSON.parse(
    runGh([
      "release",
      "view",
      tag,
      "--repo",
      repo,
      "--json",
      "assets,isDraft,isPrerelease,tagName,targetCommitish,url"
    ])
  );
}

export function assertReleaseIsDraft(options) {
  const { tag, target } = options;
  const release = readRelease(options);
  if (release.tagName !== tag || release.targetCommitish !== target || release.isDraft !== true) {
    throw new Error(
      `Desktop build dispatch requires a hidden Draft release for ${tag} targeting ${target}; got ${release.targetCommitish} at ${release.url}.`
    );
  }
  console.log(`[desktop:release] draft release ready: ${release.url}`);
}

export function createDraftRelease(options) {
  const { channel, releaseNotes, repo, tag, target } = options;
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
    releaseNotes,
    "--draft"
  ];
  if (channel === "beta") {
    args.push("--prerelease");
  }

  runGh(args, { capture: false });
  assertReleaseIsDraft(options);
}

export function dispatchDesktopWorkflowRun({ repo, workflow, branch, inputs }, runCommand = runGh) {
  const response = JSON.parse(runCommand([
    "api", "--method", "POST", `repos/${repo}/actions/workflows/${workflow}/dispatches`,
    "-H", "X-GitHub-Api-Version: 2022-11-28", "--input", "-"
  ], { input: JSON.stringify({ ref: branch, inputs, return_run_details: true }) }));
  if (!Number.isSafeInteger(response.workflow_run_id) || response.workflow_run_id <= 0) {
    throw new Error("Workflow dispatch did not return a valid workflow_run_id; do not redispatch blindly.");
  }
  return { runId: response.workflow_run_id };
}

export function dispatchReleaseWorkflow(options) {
  const { branch, nodeVersion, publishLinuxAptOnly, releaseNotesUrl, repo, tag, target, workflow } = options;
  return dispatchDesktopWorkflowRun({ repo, workflow, branch, inputs: {
    release_tag: tag, release_target: target, release_notes_url: releaseNotesUrl,
    node_version: nodeVersion, dispatch_id: randomUUID(),
    publish_linux_apt_only: String(publishLinuxAptOnly === true)
  }});
}

export function prepareDesktopDraft(options, aheadCount, run) {
  const { branch, channel, dryRun, existingReleaseComplete, publishLinuxAptOnly, reuseExistingRelease, tag } = options;
  if (dryRun) {
    console.log(`[desktop:release] would create or reuse hidden Draft ${tag}.`);
    return;
  }
  if (aheadCount > 0) {
    console.log(`[desktop:release] pushing ${aheadCount} local commit(s) to origin/${branch}`);
    run("git", ["push", "origin", `HEAD:${branch}`], { capture: false });
  }
  if (existingReleaseComplete || publishLinuxAptOnly) {
    console.log(`[desktop:release] reusing published checkpoint ${tag}; no Draft is required.`);
    return;
  }
  if (reuseExistingRelease) {
    assertReleaseIsDraft(options);
  } else {
    createDraftRelease(options);
  }
  console.log(channel === "stable" ? "DESKTOP_DRAFT_READY" : "DESKTOP_BETA_DRAFT_READY");
}

export async function readDesktopWorkflowRun(repo, runId, readJson = async (command, args) => JSON.parse(runGh(args, { timeout: 20_000 }))) {
  const args = ["run", "view", String(runId), "--repo", repo, "--json"];
  const fields = "databaseId,status,conclusion,url,headSha";
  const read = async fields => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try { return await readJson("gh", [...args, fields]); }
      catch (error) {
        const detail = `${error?.message ?? error}\n${error?.stderr ?? ""}`;
        if (attempt === 4 || !/HTTP (404|5\d\d)|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|\bEOF\b|i\/o timeout/.test(detail)) throw error;
        await sleep(1000 * 2 ** attempt);
      }
    }
  };
  const summary = await read(fields);
  // GitHub can expose the run ID before its jobs endpoint exists.
  if (["queued", "requested", "waiting", "pending"].includes(summary.status)) return summary;
  return await read(`${fields},jobs`);
}
