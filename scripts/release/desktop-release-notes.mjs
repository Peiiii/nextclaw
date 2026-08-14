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

export function assertDesktopGithubReleaseNotes(options) {
  const { channel, notes, notesFile } = options;
  if (channel !== "stable") {
    return;
  }
  if (!notesFile) {
    throw new Error(
      "Stable desktop release requires --notes-file with a GitHub-ready bilingual release body."
    );
  }

  const normalizedNotes = notes.trim();
  if (/^---(?:\r?\n|$)/.test(normalizedNotes)) {
    throw new Error("GitHub release notes must not include documentation YAML frontmatter.");
  }

  const chineseHeadingIndex = normalizedNotes.indexOf("## 中文");
  const englishHeadingIndex = normalizedNotes.indexOf("## English");
  if (chineseHeadingIndex < 0 || englishHeadingIndex < 0 || chineseHeadingIndex >= englishHeadingIndex) {
    throw new Error("GitHub release notes must contain `## 中文` followed by `## English`.");
  }

  const chineseSection = normalizedNotes.slice(chineseHeadingIndex + "## 中文".length, englishHeadingIndex);
  const englishSection = normalizedNotes.slice(englishHeadingIndex + "## English".length);
  if (!/[\u3400-\u9fff]/u.test(chineseSection)) {
    throw new Error("The `## 中文` section must contain Chinese release content.");
  }
  if (!/[A-Za-z]{3}/.test(englishSection)) {
    throw new Error("The `## English` section must contain English release content.");
  }

  if (/\]\((?:\/|\.\.?\/)/.test(normalizedNotes)) {
    throw new Error("GitHub release notes must use absolute public URLs instead of relative Markdown links.");
  }
  if (!chineseSection.includes("https://docs.nextclaw.io/zh/notes/")) {
    throw new Error("The Chinese section must link to the absolute Chinese release notes URL.");
  }
  if (!englishSection.includes("https://docs.nextclaw.io/en/notes/")) {
    throw new Error("The English section must link to the absolute English release notes URL.");
  }
  if (/^## What's Changed\s*$/m.test(normalizedNotes) || /^\*\*Full Changelog\*\*/m.test(normalizedNotes)) {
    throw new Error("GitHub release notes must not include auto-generated commit or changelog noise.");
  }
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
