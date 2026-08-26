function readGhPagesManifest({ channel, repo, run, target }) {
  const encodedContent = run("gh", [
    "api",
    `repos/${repo}/contents/npm-runtime-updates/${channel}/manifest-${channel}-${target.platform}-${target.arch}.json?ref=gh-pages`,
    "--jq",
    ".content"
  ], { capture: true }).replace(/\s+/g, "");

  return JSON.parse(Buffer.from(encodedContent, "base64").toString("utf8"));
}

function assertRuntimeManifest({ expectedReleaseNotesUrl, expectedVersion, label, manifest, target }) {
  if (manifest.latestVersion !== expectedVersion) {
    throw new Error(
      `${label} version mismatch for ${target.platform}-${target.arch}: expected ${expectedVersion}, got ${manifest.latestVersion}`
    );
  }
  if (manifest.hostKind !== "npm-runtime-bundle") {
    throw new Error(`${label} hostKind mismatch for ${target.platform}-${target.arch}: ${manifest.hostKind}`);
  }
  if (expectedReleaseNotesUrl && manifest.releaseNotesUrl !== expectedReleaseNotesUrl) {
    throw new Error(
      `${label} releaseNotesUrl mismatch for ${target.platform}-${target.arch}: expected ${expectedReleaseNotesUrl}, got ${manifest.releaseNotesUrl ?? "null"}`
    );
  }
}

function inspectGhPagesRuntimeManifests({ channel, expectedReleaseNotesUrl, expectedVersion, repo, run, targets }) {
  for (const target of targets) {
    let manifest;
    try {
      manifest = readGhPagesManifest({ channel, repo, run, target });
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), target };
    }
    if (manifest.latestVersion !== expectedVersion) {
      return { latestVersion: manifest.latestVersion, target };
    }
    assertRuntimeManifest({
      expectedReleaseNotesUrl,
      expectedVersion,
      label: "gh-pages manifest",
      manifest,
      target
    });
  }
  return null;
}

function readPublicManifest({ channel, readJsonCommand, target }) {
  const manifestUrl = `https://peiiii.github.io/nextclaw/npm-runtime-updates/${channel}/manifest-${channel}-${target.platform}-${target.arch}.json?ts=${Date.now()}`;
  return readJsonCommand("curl", ["-fsSL", manifestUrl]);
}

function tryReadPublicManifest(params) {
  try {
    return {
      manifest: readPublicManifest(params)
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function readGitHubPagesStatus({ readJsonCommand, repo }) {
  const pages = readJsonCommand("gh", ["api", `repos/${repo}/pages`]);
  return typeof pages.status === "string" ? pages.status : "unknown";
}

export async function verifyPublicRuntimeManifests({
  channel,
  expectedReleaseNotesUrl,
  expectedVersion,
  readJsonCommand,
  repo,
  run,
  sleep,
  targets
}) {
  await waitForGhPagesRuntimeManifests({
    channel,
    expectedReleaseNotesUrl,
    expectedVersion,
    repo,
    run,
    sleep,
    targets
  });
  return await waitForPublicRuntimeManifests({
    channel,
    expectedReleaseNotesUrl,
    expectedVersion,
    readJsonCommand,
    repo,
    sleep,
    targets
  });
}

async function waitForGhPagesRuntimeManifests(options) {
  let ghPagesPending = null;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    ghPagesPending = inspectGhPagesRuntimeManifests(options);
    if (!ghPagesPending) break;
    if (attempt < 35) await options.sleep(5000);
  }
  if (ghPagesPending) {
    throw new Error(
      `Timed out waiting for gh-pages runtime manifest ${options.expectedVersion} for ${ghPagesPending.target.platform}-${ghPagesPending.target.arch}; last observation: ${ghPagesPending.error ?? `version ${ghPagesPending.latestVersion ?? "<missing>"}`}.`
    );
  }
}

async function waitForPublicRuntimeManifests(options) {
  const { channel, expectedReleaseNotesUrl, expectedVersion, readJsonCommand, repo, sleep, targets } = options;
  let lastPagesStatus = "unknown";
  let lastMismatch = null;

  for (let attempt = 0; attempt < 36; attempt += 1) {
    try {
      lastPagesStatus = readGitHubPagesStatus({ readJsonCommand, repo });
    } catch {
      lastPagesStatus = "unknown";
    }
    lastMismatch = null;

    for (const target of targets) {
      const publicManifestResult = tryReadPublicManifest({
        channel,
        readJsonCommand,
        target
      });
      if (publicManifestResult.error) {
        lastMismatch = {
          error: publicManifestResult.error,
          expectedVersion,
          latestVersion: "<read failed>",
          target
        };
        break;
      }
      const manifest = publicManifestResult.manifest;
      if (manifest.latestVersion !== expectedVersion) {
        lastMismatch = {
          expectedVersion,
          latestVersion: manifest.latestVersion,
          target
        };
        break;
      }
      assertRuntimeManifest({
        expectedReleaseNotesUrl,
        expectedVersion,
        label: "Public manifest",
        manifest,
        target
      });
    }

    if (!lastMismatch) {
      return {
        pagesStatus: lastPagesStatus,
        source: "public"
      };
    }

    await sleep(5000);
  }

  if (lastPagesStatus === "built") {
    const errorSuffix = lastMismatch?.error ? ` (${lastMismatch.error})` : "";
    throw new Error(
      `Public manifest version mismatch for ${lastMismatch.target.platform}-${lastMismatch.target.arch}: expected ${lastMismatch.expectedVersion}, got ${lastMismatch.latestVersion}${errorSuffix}`
    );
  }

  console.warn(
    `[release:beta] GitHub Pages is still ${lastPagesStatus}; gh-pages manifests already point to ${expectedVersion}. Public URLs may lag briefly.`
  );

  return {
    pagesStatus: lastPagesStatus,
    source: "gh-pages"
  };
}
