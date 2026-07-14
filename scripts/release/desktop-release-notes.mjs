export function resolveDesktopReleaseNotesUrl(options) {
  const { channel, explicitReleaseNotesUrl, readTargetFile, repo, runtimeVersion, tag, target } = options;
  const explicitUrl = explicitReleaseNotesUrl?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const metadataPath = `apps/docs/public/release-notes/nextclaw-v${runtimeVersion}.json`;
  const rawMetadata = readTargetFile(target, metadataPath);
  if (rawMetadata) {
    return readReleaseNotesHtmlUrl(rawMetadata, metadataPath, runtimeVersion);
  }

  if (channel === "stable") {
    throw new Error(
      [
        `Stable desktop release requires structured release notes for runtime ${runtimeVersion}.`,
        `Add ${metadataPath} to the release target,`,
        "or pass --release-notes-url <url> for an explicit recovery rerun."
      ].join("\n")
    );
  }

  return `https://github.com/${repo}/releases/tag/${tag}`;
}

function readReleaseNotesHtmlUrl(rawMetadata, metadataPath, runtimeVersion) {
  let metadata;
  try {
    metadata = JSON.parse(rawMetadata);
  } catch (error) {
    throw new Error(`Invalid release notes JSON in ${metadataPath}: ${error instanceof Error ? error.message : error}`);
  }

  if (metadata.version !== runtimeVersion) {
    throw new Error(`Release notes JSON version mismatch in ${metadataPath}: expected ${runtimeVersion}, got ${metadata.version}`);
  }

  const htmlUrl = metadata.links?.html?.["en-US"] ?? metadata.links?.html?.["zh-CN"];
  if (typeof htmlUrl !== "string" || !htmlUrl.trim()) {
    throw new Error(`Release notes JSON is missing links.html.en-US or links.html.zh-CN: ${metadataPath}`);
  }

  return htmlUrl.trim();
}
