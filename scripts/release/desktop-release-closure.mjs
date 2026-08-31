import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT_DIR = process.cwd();

function run(command, args) {
  const output = execFileSync(command, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return typeof output === "string" ? output.trim() : "";
}

function isRetryableCommandError(error) {
  const stderr = String(error?.stderr ?? "");
  const message = String(error?.message ?? "");
  return /tls: failed to verify certificate|Client\.Timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|\bEOF\b|502 Bad Gateway|503 Service Unavailable|504 Gateway Timeout/.test(
    `${stderr}\n${message}`
  );
}

async function readJsonCommand(command, args) {
  const output = await readTextCommand(command, args);
  return JSON.parse(output);
}

async function readTextCommand(command, args) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return run(command, args);
    } catch (error) {
      if (attempt >= 3 || !isRetryableCommandError(error)) {
        throw error;
      }
      console.warn(`[desktop:release] retrying ${command} query after transient network error (${attempt}/3)`);
      await sleep(1000 * attempt);
    }
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

async function waitForWorkflowRun(options) {
  const {
    repo,
    runId,
    workflow,
    workflowDispatchId,
    workflowDispatchStartedAt = 0
  } = options;
  if (runId) {
    return await readWorkflowRun(repo, runId);
  }

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const runs = await readJsonCommand("gh", [
      "run",
      "list",
      "--repo",
      repo,
      "--workflow",
      workflow,
      "--event",
      "workflow_dispatch",
      "--limit",
      "40",
      "--json",
      "databaseId,createdAt,displayTitle,headSha,status,conclusion,url"
    ]);
    const runEntry = runs.find(
      (entry) =>
        String(entry.displayTitle ?? "").includes(`dispatch=${workflowDispatchId}`) &&
        Date.parse(entry.createdAt ?? "") >= workflowDispatchStartedAt - 60_000
    );
    if (runEntry) {
      return runEntry;
    }
    await sleep(5000);
  }

  throw new Error(`Timed out locating ${workflow} workflow_dispatch run for ${options.tag}.`);
}

async function readWorkflowRun(repo, runId) {
  return await readJsonCommand("gh", [
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

function durationMs(startedAt, completedAt) {
  const started = Date.parse(startedAt ?? "");
  const completed = Date.parse(completedAt ?? "");
  return Number.isFinite(started) && Number.isFinite(completed) ? Math.max(0, completed - started) : null;
}

export function buildDesktopReleaseObservation(runSummary) {
  const jobs = (runSummary.jobs ?? []).map((job) => {
    const completedSteps = (job.steps ?? [])
      .map((step) => ({
        conclusion: step.conclusion ?? null,
        durationMs: durationMs(step.startedAt, step.completedAt),
        name: step.name
      }))
      .filter((step) => step.durationMs !== null);
    const slowestStep = completedSteps.sort((left, right) => right.durationMs - left.durationMs)[0] ?? null;
    return {
      completedAt: job.completedAt ?? null,
      conclusion: job.conclusion ?? null,
      durationMs: durationMs(job.startedAt, job.completedAt),
      name: job.name,
      slowestStep,
      startedAt: job.startedAt ?? null,
      status: job.status
    };
  });
  const startedAt = jobs.map((job) => job.startedAt).filter(Boolean).sort()[0] ?? null;
  const completedAt = jobs.map((job) => job.completedAt).filter(Boolean).sort().at(-1) ?? null;
  return {
    completedAt,
    conclusion: runSummary.conclusion ?? null,
    headSha: runSummary.headSha ?? null,
    jobs,
    runId: runSummary.databaseId ?? null,
    schema: "nextclaw.desktop-release/v1",
    startedAt,
    status: runSummary.status,
    wallMs: durationMs(startedAt, completedAt)
  };
}

function printDesktopReleaseObservation(runSummary) {
  console.log(`[desktop:release-observation] ${JSON.stringify(buildDesktopReleaseObservation(runSummary))}`);
}

async function waitForWorkflowSuccess(options, runEntry) {
  const { repo, runAttempts, runDelayMs, runId: optionRunId } = options;
  const runId = runEntry.databaseId ?? optionRunId;
  let previousLine = "";
  for (let attempt = 1; attempt <= runAttempts; attempt += 1) {
    const runSummary = await readWorkflowRun(repo, runId);
    const jobSummary = summarizeJobs(runSummary);
    const line = `[desktop:release] run ${runId}: ${runSummary.status}/${runSummary.conclusion || "pending"} jobs ${jobSummary.completed}/${jobSummary.total} ${jobSummary.important}`;
    if (line !== previousLine) {
      console.log(line);
      previousLine = line;
    }
    if (jobSummary.failed.length > 0) {
      printDesktopReleaseObservation(runSummary);
      throw new Error(`Workflow has failed jobs: ${runSummary.url}`);
    }
    if (runSummary.status === "completed") {
      printDesktopReleaseObservation(runSummary);
      if (runSummary.conclusion !== "success") {
        throw new Error(`Workflow did not finish successfully: ${runSummary.url}`);
      }
      return runSummary;
    }
    await sleep(runDelayMs);
  }
  try {
    run("gh", ["run", "cancel", String(runId), "--repo", repo]);
  } catch (error) {
    console.warn(`[desktop:release] failed to cancel timed-out workflow ${runId}: ${error instanceof Error ? error.message : error}`);
  }
  throw new Error(`Timed out waiting for workflow success: ${runEntry.url ?? runId}`);
}

export function buildExpectedDesktopReleaseAssetNames(options) {
  const { channel, desktopVersion, runtimeVersion } = options;
  return [
    "latest-mac-arm64.yml",
    "latest-mac-x64.yml",
    "latest.yml",
    `manifest-${channel}-darwin-arm64.json`,
    `manifest-${channel}-darwin-x64.json`,
    `manifest-${channel}-linux-x64.json`,
    `manifest-${channel}-win32-arm64.json`,
    `manifest-${channel}-win32-x64.json`,
    `nextclaw-bundle-darwin-arm64-${runtimeVersion}.zip`,
    `nextclaw-bundle-darwin-x64-${runtimeVersion}.zip`,
    `nextclaw-bundle-linux-x64-${runtimeVersion}.zip`,
    `nextclaw-bundle-win32-arm64-${runtimeVersion}.zip`,
    `nextclaw-bundle-win32-x64-${runtimeVersion}.zip`,
    `nextclaw-desktop_${desktopVersion}_amd64.deb`,
    `NextClaw-Portable-${desktopVersion}-win-arm64.zip`,
    `NextClaw-Portable-${desktopVersion}-win-x64.zip`,
    `NextClaw.Desktop-${desktopVersion}-arm64-mac.zip`,
    `NextClaw.Desktop-${desktopVersion}-arm64-mac.zip.blockmap`,
    `NextClaw.Desktop-${desktopVersion}-arm64.dmg`,
    `NextClaw.Desktop-${desktopVersion}-arm64.dmg.blockmap`,
    `NextClaw.Desktop-${desktopVersion}-linux-x64.AppImage`,
    `NextClaw.Desktop-${desktopVersion}-win32-arm64-unpacked.zip`,
    `NextClaw.Desktop-${desktopVersion}-win32-x64-unpacked.zip`,
    `NextClaw.Desktop-${desktopVersion}-x64-mac.zip`,
    `NextClaw.Desktop-${desktopVersion}-x64-mac.zip.blockmap`,
    `NextClaw.Desktop-${desktopVersion}-x64.dmg`,
    `NextClaw.Desktop-${desktopVersion}-x64.dmg.blockmap`,
    `NextClaw.Desktop-Setup-${desktopVersion}-x64.exe`,
    `NextClaw.Desktop-Setup-${desktopVersion}-x64.exe.blockmap`,
    "update-bundle-public.pem"
  ];
}

export function assertDesktopReleaseAssetSet(assetNames, options) {
  const expectedAssets = buildExpectedDesktopReleaseAssetNames(options);
  const actualAssets = new Set(assetNames);
  const expectedAssetSet = new Set(expectedAssets);
  const optionalAssetSet = new Set([
    `nextclaw-desktop_${options.desktopVersion}_amd64.pages.deb`
  ]);
  const missingAssets = expectedAssets.filter((assetName) => !actualAssets.has(assetName));
  const unexpectedAssets = [...actualAssets]
    .filter((assetName) => !expectedAssetSet.has(assetName) && !optionalAssetSet.has(assetName))
    .sort();
  if (missingAssets.length > 0 || unexpectedAssets.length > 0) {
    throw new Error(
      [
        `Desktop release asset set is incomplete for ${options.tag ?? "target release"}.`,
        missingAssets.length > 0 ? `Missing: ${missingAssets.join(", ")}` : null,
        unexpectedAssets.length > 0 ? `Unexpected: ${unexpectedAssets.join(", ")}` : null
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
  return expectedAssets;
}

export function assertDesktopReleaseAssetMetadata(assets, options) {
  const invalidAssets = assets
    .filter((asset) => asset.state !== "uploaded" || !Number.isFinite(asset.size) || asset.size <= 0)
    .map((asset) => `${asset.name}:${asset.state ?? "unknown"}/${asset.size ?? "unknown"}`);
  if (invalidAssets.length > 0) {
    throw new Error(
      `Desktop release contains incomplete asset uploads for ${options.tag ?? "target release"}: ${invalidAssets.join(", ")}`
    );
  }
}

export async function verifyReleaseAssets(options) {
  const { channel, expectedDraft, repo, tag } = options;
  const release = await readJsonCommand("gh", [
    "release",
    "view",
    tag,
    "--repo",
    repo,
    "--json",
    "assets,isDraft,isPrerelease,tagName,url,targetCommitish"
  ]);
  if (Boolean(release.isPrerelease) !== (channel === "beta")) {
    throw new Error(`Release prerelease flag mismatch: ${release.url}`);
  }
  if (typeof expectedDraft === "boolean" && release.isDraft !== expectedDraft) {
    throw new Error(
      `Release draft state mismatch for ${tag}: expected ${expectedDraft}, got ${release.isDraft}.`
    );
  }
  const expectedAssets = assertDesktopReleaseAssetSet(
    (release.assets ?? []).map((asset) => asset.name),
    options
  );
  assertDesktopReleaseAssetMetadata(release.assets ?? [], options);
  console.log(`[desktop:release] release assets OK: ${expectedAssets.join(", ")}`);
}

async function readGhPagesManifest(options) {
  const { channel, repo } = options;
  const manifestUrl =
    `https://raw.githubusercontent.com/${repo}/gh-pages/desktop-updates/${channel}/` +
    `manifest-${channel}-win32-x64.json`;
  return await (options.readJsonCommand ?? readJsonCommand)("curl", [
    "-fsSL",
    `${manifestUrl}?desktopRelease=${Date.now()}`
  ]);
}

function assertManifest(manifest, options, label) {
  const { minimumLauncherVersion, releaseNotesUrl, runtimeVersion } = options;
  if (manifest.latestVersion !== runtimeVersion) {
    throw new Error(`${label} latestVersion mismatch: expected ${runtimeVersion}, got ${manifest.latestVersion}`);
  }
  if (manifest.minimumLauncherVersion !== minimumLauncherVersion) {
    throw new Error(
      `${label} minimumLauncherVersion mismatch: expected ${minimumLauncherVersion}, got ${manifest.minimumLauncherVersion}`
    );
  }
  if (releaseNotesUrl && manifest.releaseNotesUrl !== releaseNotesUrl) {
    throw new Error(
      `${label} releaseNotesUrl mismatch: expected ${releaseNotesUrl}, got ${manifest.releaseNotesUrl ?? "null"}`
    );
  }
}

export async function waitForPublicManifest(options) {
  const { channel, publicAttempts, publicDelayMs, runtimeVersion, skipPublicPages } = options;
  if (skipPublicPages) {
    console.log("[desktop:release] public Pages verification skipped by flag.");
    return;
  }

  const manifestUrl =
    `https://peiiii.github.io/nextclaw/desktop-updates/${channel}/manifest-${channel}-win32-x64.json`;
  let lastObservation = "not read";
  for (let attempt = 1; attempt <= publicAttempts; attempt += 1) {
    let manifest = null;
    try {
      manifest = await (options.readJsonCommand ?? readJsonCommand)("curl", [
        "-fsSL",
        `${manifestUrl}?desktopRelease=${Date.now()}-${attempt}`
      ]);
      lastObservation = `version ${manifest.latestVersion ?? "<missing>"}`;
    } catch (error) {
      lastObservation = `read pending: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (manifest?.latestVersion === runtimeVersion) {
      assertManifest(manifest, options, "public Pages manifest");
      console.log(`[desktop:release] public Pages manifest OK: ${manifest.latestVersion}`);
      return;
    }
    console.warn(`[desktop:release] public Pages attempt ${attempt}/${publicAttempts}: ${lastObservation}`);
    if (attempt < publicAttempts) {
      await (options.sleep ?? sleep)(publicDelayMs);
    }
  }
  throw new Error(`Timed out waiting for public Pages manifest ${runtimeVersion}; last observation: ${lastObservation}.`);
}

export async function waitForGhPagesManifest(options) {
  const { publicAttempts, publicDelayMs, runtimeVersion } = options;
  let lastObservation = "not read";
  for (let attempt = 1; attempt <= publicAttempts; attempt += 1) {
    let manifest = null;
    try {
      manifest = await readGhPagesManifest(options);
      lastObservation = `version ${manifest.latestVersion ?? "<missing>"}`;
    } catch (error) {
      lastObservation = `read pending: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (manifest?.latestVersion === runtimeVersion) {
      assertManifest(manifest, options, "gh-pages manifest");
      console.log(`[desktop:release] gh-pages manifest OK: ${manifest.latestVersion}`);
      return;
    }
    if (attempt < publicAttempts) await (options.sleep ?? sleep)(publicDelayMs);
  }
  throw new Error(`Timed out waiting for gh-pages manifest ${runtimeVersion}; last observation: ${lastObservation}.`);
}

async function verifyStableAptRepo(options) {
  const { channel, desktopVersion, repo } = options;
  if (channel !== "stable") {
    return;
  }
  const packagesText = await (options.readTextCommand ?? readTextCommand)("curl", [
    "-fsSL",
    `https://raw.githubusercontent.com/${repo}/gh-pages/apt/dists/stable/main/binary-amd64/Packages?desktopRelease=${Date.now()}`
  ]);
  if (!packagesText.includes(`Version: ${desktopVersion}`)) {
    throw new Error(`gh-pages APT Packages does not contain Version: ${desktopVersion}`);
  }
  console.log(`[desktop:release] gh-pages stable APT repo OK: ${desktopVersion}`);
}

export async function waitForPublicStableAptRepo(options) {
  const { channel, desktopVersion, publicAttempts, publicDelayMs, skipPublicPages } = options;
  if (channel !== "stable" || skipPublicPages) {
    return;
  }
  let lastObservation = "not read";
  for (let attempt = 1; attempt <= publicAttempts; attempt += 1) {
    try {
      const packagesText = await (options.readTextCommand ?? readTextCommand)("curl", [
        "-fsSL",
        `https://peiiii.github.io/nextclaw/apt/dists/stable/main/binary-amd64/Packages?desktopRelease=${Date.now()}-${attempt}`
      ]);
      lastObservation = packagesText.includes(`Version: ${desktopVersion}`)
        ? `version ${desktopVersion}`
        : `version ${desktopVersion} not visible`;
      if (packagesText.includes(`Version: ${desktopVersion}`)) {
        console.log(`[desktop:release] public stable APT repo OK: ${desktopVersion}`);
        return;
      }
    } catch (error) {
      lastObservation = `read pending: ${error instanceof Error ? error.message : String(error)}`;
    }
    console.warn(`[desktop:release] public APT attempt ${attempt}/${publicAttempts}: ${lastObservation}`);
    if (attempt < publicAttempts) {
      await (options.sleep ?? sleep)(publicDelayMs);
    }
  }
  throw new Error(`Timed out waiting for public stable APT repo ${desktopVersion}; last observation: ${lastObservation}.`);
}

async function waitForGhPagesStableAptRepo(options) {
  const { channel, desktopVersion, publicAttempts, publicDelayMs } = options;
  if (channel !== "stable") return;
  let lastObservation = "not read";
  for (let attempt = 1; attempt <= publicAttempts; attempt += 1) {
    try {
      await verifyStableAptRepo(options);
      return;
    } catch (error) {
      lastObservation = error instanceof Error ? error.message : String(error);
    }
    if (attempt < publicAttempts) await (options.sleep ?? sleep)(publicDelayMs);
  }
  throw new Error(`Timed out waiting for gh-pages stable APT repo ${desktopVersion}; last observation: ${lastObservation}.`);
}

export async function waitForDesktopReleaseClosure(options) {
  const { tag, target } = options;
  const runEntry = await waitForWorkflowRun(options);
  await waitForWorkflowSuccess(options, runEntry);
  const tagSha = readTagSha(tag);
  if (tagSha !== target) {
    throw new Error(`Published tag target mismatch: expected ${target}, got ${tagSha}.`);
  }
  await verifyReleaseAssets({ ...options, expectedDraft: false });

  await waitForGhPagesManifest(options);
  await waitForPublicManifest(options);
  await waitForGhPagesStableAptRepo(options);
  await waitForPublicStableAptRepo(options);
  console.log(`[desktop:release] complete: ${tag}`);
}

export async function verifyExistingDesktopReleaseClosure(options) {
  const { tag, target } = options;
  const tagSha = readTagSha(tag);
  if (tagSha !== target) throw new Error(`Published tag target mismatch: expected ${target}, got ${tagSha}.`);
  await verifyReleaseAssets({ ...options, expectedDraft: false });
  await waitForGhPagesManifest(options);
  await waitForPublicManifest(options);
  await waitForGhPagesStableAptRepo(options);
  await waitForPublicStableAptRepo(options);
  console.log(`[desktop:release] existing release already complete: ${tag}`);
}
