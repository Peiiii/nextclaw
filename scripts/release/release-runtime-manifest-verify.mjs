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

function verifyGhPagesRuntimeManifests({ channel, expectedReleaseNotesUrl, expectedVersion, repo, run, targets }) {
  for (const target of targets) {
    const manifest = readGhPagesManifest({
      channel,
      repo,
      run,
      target
    });
    assertRuntimeManifest({
      expectedReleaseNotesUrl,
      expectedVersion,
      label: "gh-pages manifest",
      manifest,
      target
    });
  }
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
  verifyGhPagesRuntimeManifests({
    channel,
    expectedReleaseNotesUrl,
    expectedVersion,
    repo,
    run,
    targets
  });

  let lastPagesStatus = "unknown";
  let lastMismatch = null;

  for (let attempt = 0; attempt < 36; attempt += 1) {
    lastPagesStatus = readGitHubPagesStatus({
      readJsonCommand,
      repo
    });
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
      try {
        assertRuntimeManifest({
          expectedReleaseNotesUrl,
          expectedVersion,
          label: "Public manifest",
          manifest,
          target
        });
      } catch (error) {
        lastMismatch = {
          error: error instanceof Error ? error.message : String(error),
          expectedVersion,
          latestVersion: manifest.latestVersion,
          target
        };
        break;
      }
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
