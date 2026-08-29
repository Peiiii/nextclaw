import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const ROOT_DIR = process.cwd();

function runGh(args, options = {}) {
  const output = execFileSync("gh", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"]
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

function readRelease(options) {
  const { repo, tag } = options;
  return JSON.parse(
    runGh([
      "release",
      "view",
      tag,
      "--repo",
      repo,
      "--json",
      "isDraft,tagName,targetCommitish,url"
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

export function dispatchReleaseWorkflow(options) {
  const { branch, nodeVersion, releaseNotesUrl, repo, tag, target, workflow } = options;
  const workflowDispatchId = randomUUID();
  const workflowDispatchStartedAt = Date.now();
  runGh([
    "workflow",
    "run",
    workflow,
    "--repo",
    repo,
    "--ref",
    branch,
    "-f",
    `release_tag=${tag}`,
    "-f",
    `release_target=${target}`,
    "-f",
    `release_notes_url=${releaseNotesUrl}`,
    "-f",
    `node_version=${nodeVersion}`,
    "-f",
    `dispatch_id=${workflowDispatchId}`
  ]);
  console.log(`[desktop:release] dispatched ${workflow} for hidden Draft ${tag} (${workflowDispatchId})`);
  return { workflowDispatchId, workflowDispatchStartedAt };
}
