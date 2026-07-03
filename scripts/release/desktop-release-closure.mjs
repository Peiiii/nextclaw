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

function isRetryableGitFetchError(error) {
  const stderr = String(error?.stderr ?? "");
  const message = String(error?.message ?? "");
  return /cannot lock ref|is at .* but expected/.test(`${stderr}\n${message}`);
}

async function fetchGhPagesWithRetry() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      run("git", ["-c", "gc.auto=0", "fetch", "origin", "gh-pages", "--quiet"]);
      return;
    } catch (error) {
      if (attempt >= 3 || !isRetryableGitFetchError(error)) {
        throw error;
      }
      console.warn(`[desktop:release] gh-pages fetch ref lock; retrying ${attempt}/3`);
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

async function waitForWorkflowRun(options, tagSha) {
  const { repo, runId, runtimeVersion, tag, workflow } = options;
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
      "release",
      "--limit",
      "40",
      "--json",
      "databaseId,displayTitle,headSha,status,conclusion,url"
    ]);
    const runEntry = runs.find(
      (entry) =>
        entry.headSha === tagSha ||
        String(entry.displayTitle ?? "").includes(tag) ||
        String(entry.displayTitle ?? "").includes(runtimeVersion)
    );
    if (runEntry) {
      return runEntry;
    }
    await sleep(5000);
  }

  throw new Error(`Timed out locating ${workflow} release run for ${tag}.`);
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
      throw new Error(`Workflow has failed jobs: ${runSummary.url}`);
    }
    if (runSummary.status === "completed") {
      if (runSummary.conclusion !== "success") {
        throw new Error(`Workflow did not finish successfully: ${runSummary.url}`);
      }
      return runSummary;
    }
    await sleep(runDelayMs);
  }
  throw new Error(`Timed out waiting for workflow success: ${runEntry.url ?? runId}`);
}

async function verifyReleaseAssets(options) {
  const { channel, desktopVersion, repo, runtimeVersion, tag } = options;
  const release = await readJsonCommand("gh", [
    "release",
    "view",
    tag,
    "--repo",
    repo,
    "--json",
    "assets,isPrerelease,tagName,url,targetCommitish"
  ]);
  if (Boolean(release.isPrerelease) !== (channel === "beta")) {
    throw new Error(`Release prerelease flag mismatch: ${release.url}`);
  }

  const expectedAssets = [
    `NextClaw-Portable-${desktopVersion}-win-x64.zip`,
    `NextClaw-Portable-${desktopVersion}-win-arm64.zip`,
    `NextClaw.Desktop-Setup-${desktopVersion}-x64.exe`,
    `nextclaw-bundle-win32-x64-${runtimeVersion}.zip`,
    `manifest-${channel}-win32-x64.json`,
    "update-bundle-public.pem"
  ];
  if (channel === "stable") {
    expectedAssets.push(`nextclaw-desktop_${desktopVersion}_amd64.deb`);
  }

  const assetNames = new Set((release.assets ?? []).map((asset) => asset.name));
  const missingAssets = expectedAssets.filter((assetName) => !assetNames.has(assetName));
  if (missingAssets.length > 0) {
    throw new Error(`Missing release assets on ${tag}: ${missingAssets.join(", ")}`);
  }
  const npmRuntimeAssets = [...assetNames].filter((assetName) => /^nextclaw-runtime-.*\.zip$/.test(assetName));
  if (npmRuntimeAssets.length > 0) {
    throw new Error(
      `Desktop release contains NPM runtime assets on ${tag}: ${npmRuntimeAssets.join(", ")}`
    );
  }
  console.log(`[desktop:release] release assets OK: ${expectedAssets.join(", ")}`);
}

async function readGhPagesManifest(options) {
  const { channel } = options;
  await fetchGhPagesWithRetry();
  return JSON.parse(
    run("git", [
      "show",
      `origin/gh-pages:desktop-updates/${channel}/manifest-${channel}-win32-x64.json`
    ])
  );
}

function assertManifest(manifest, options, label) {
  const { minimumLauncherVersion, runtimeVersion } = options;
  if (manifest.latestVersion !== runtimeVersion) {
    throw new Error(`${label} latestVersion mismatch: expected ${runtimeVersion}, got ${manifest.latestVersion}`);
  }
  if (manifest.minimumLauncherVersion !== minimumLauncherVersion) {
    throw new Error(
      `${label} minimumLauncherVersion mismatch: expected ${minimumLauncherVersion}, got ${manifest.minimumLauncherVersion}`
    );
  }
}

async function waitForPublicManifest(options) {
  const { channel, publicAttempts, publicDelayMs, runtimeVersion, skipPublicPages } = options;
  if (skipPublicPages) {
    console.log("[desktop:release] public Pages verification skipped by flag.");
    return;
  }

  const manifestUrl =
    `https://peiiii.github.io/nextclaw/desktop-updates/${channel}/manifest-${channel}-win32-x64.json`;
  for (let attempt = 1; attempt <= publicAttempts; attempt += 1) {
    const manifest = await readJsonCommand("curl", ["-fsSL", `${manifestUrl}?desktopRelease=${Date.now()}-${attempt}`]);
    if (manifest.latestVersion === runtimeVersion) {
      assertManifest(manifest, options, "public Pages manifest");
      console.log(`[desktop:release] public Pages manifest OK: ${manifest.latestVersion}`);
      return;
    }
    console.warn(`[desktop:release] public Pages attempt ${attempt}/${publicAttempts}: still ${manifest.latestVersion}`);
    if (attempt < publicAttempts) {
      await sleep(publicDelayMs);
    }
  }
  throw new Error(`Public Pages manifest did not propagate to ${runtimeVersion}.`);
}

function verifyStableAptRepo(options) {
  const { channel, desktopVersion } = options;
  if (channel !== "stable") {
    return;
  }
  const packagesText = run("git", ["show", "origin/gh-pages:apt/dists/stable/main/binary-amd64/Packages"]);
  if (!packagesText.includes(`Version: ${desktopVersion}`)) {
    throw new Error(`gh-pages APT Packages does not contain Version: ${desktopVersion}`);
  }
  console.log(`[desktop:release] gh-pages stable APT repo OK: ${desktopVersion}`);
}

async function waitForPublicStableAptRepo(options) {
  const { channel, desktopVersion, publicAttempts, publicDelayMs, skipPublicPages } = options;
  if (channel !== "stable" || skipPublicPages) {
    return;
  }
  for (let attempt = 1; attempt <= publicAttempts; attempt += 1) {
    const packagesText = await readTextCommand("curl", [
      "-fsSL",
      `https://peiiii.github.io/nextclaw/apt/dists/stable/main/binary-amd64/Packages?desktopRelease=${Date.now()}-${attempt}`
    ]);
    if (packagesText.includes(`Version: ${desktopVersion}`)) {
      console.log(`[desktop:release] public stable APT repo OK: ${desktopVersion}`);
      return;
    }
    console.warn(`[desktop:release] public APT attempt ${attempt}/${publicAttempts}: missing ${desktopVersion}`);
    if (attempt < publicAttempts) {
      await sleep(publicDelayMs);
    }
  }
  throw new Error(`Public stable APT repo did not propagate to ${desktopVersion}.`);
}

export async function waitForDesktopReleaseClosure(options) {
  const tagSha = readTagSha(options.tag);
  const runEntry = await waitForWorkflowRun(options, tagSha);
  await waitForWorkflowSuccess(options, runEntry);
  await verifyReleaseAssets(options);

  const ghPagesManifest = await readGhPagesManifest(options);
  assertManifest(ghPagesManifest, options, "gh-pages manifest");
  console.log(`[desktop:release] gh-pages manifest OK: ${ghPagesManifest.latestVersion}`);
  await waitForPublicManifest(options);
  verifyStableAptRepo(options);
  await waitForPublicStableAptRepo(options);
  console.log(`[desktop:release] complete: ${options.tag}`);
}
