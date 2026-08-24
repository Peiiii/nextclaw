#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = process.cwd();
const DEFAULT_REPO = "Peiiii/nextclaw";

function extractVersionSection(changelog, version) {
  const heading = `## ${version}`;
  const start = changelog.indexOf(heading);
  if (start < 0) return "";
  const contentStart = start + heading.length;
  const nextHeading = changelog.indexOf("\n## ", contentStart);
  return changelog
    .slice(contentStart, nextHeading < 0 ? changelog.length : nextHeading)
    .trim();
}

export function resolveCoreReleaseNotes(options) {
  const {
    changelog = "",
    repo = DEFAULT_REPO,
    structuredMetadata = null,
    version,
  } = options;
  if (structuredMetadata?.version && structuredMetadata.version !== version) {
    throw new Error(
      `Structured release notes version mismatch: expected ${version}, got ${structuredMetadata.version}.`,
    );
  }
  const githubReleaseUrl = `https://github.com/${repo}/releases/tag/nextclaw@${version}`;
  const structuredUrl =
    structuredMetadata?.links?.html?.["en-US"] ??
    structuredMetadata?.links?.html?.["zh-CN"] ??
    null;
  const releaseNotesUrl = structuredUrl?.trim() || githubReleaseUrl;
  const changes = extractVersionSection(changelog, version);
  const changeBlock =
    changes ||
    "- Published the verified package and runtime artifacts for this version.";
  return {
    contentReady: Boolean(structuredUrl?.trim()),
    notes: [
      `# NextClaw v${version}`,
      "",
      "## 中文",
      "",
      "本次核心版本已通过确定性发布流水线完成。高质量中文产品说明如尚未就绪，将在同一版本下补充，不会重复发布软件包或更新包。",
      "",
      `[查看当前版本说明](${releaseNotesUrl})`,
      "",
      "## English",
      "",
      "This core release completed the deterministic release pipeline. If the full product narrative is not ready yet, it will be added to this same version without republishing packages or update bundles.",
      "",
      changeBlock,
      "",
      `[View the current release notes](${releaseNotesUrl})`,
    ].join("\n"),
    releaseNotesUrl,
  };
}

function readJsonIfPresent(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readCoreReleaseNotes(rootDir, version, repo = DEFAULT_REPO) {
  const metadataPath = resolve(
    rootDir,
    `apps/docs/public/release-notes/nextclaw-v${version}.json`,
  );
  const changelogPath = resolve(rootDir, "packages/nextclaw/CHANGELOG.md");
  return resolveCoreReleaseNotes({
    changelog: existsSync(changelogPath)
      ? readFileSync(changelogPath, "utf8")
      : "",
    repo,
    structuredMetadata: readJsonIfPresent(metadataPath),
    version,
  });
}

function parseArgs(argv) {
  const options = { format: "notes", repo: DEFAULT_REPO, version: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (["--format", "--repo", "--version"].includes(arg)) {
      options[arg.slice(2)] = argv[index + 1] ?? "";
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.version?.trim()) throw new Error("--version is required.");
  if (!["content-ready", "notes", "url"].includes(options.format)) {
    throw new Error(`Unsupported --format: ${options.format}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = readCoreReleaseNotes(
    ROOT_DIR,
    options.version.trim(),
    options.repo.trim() || DEFAULT_REPO,
  );
  if (options.format === "url") {
    process.stdout.write(result.releaseNotesUrl);
  } else if (options.format === "content-ready") {
    process.stdout.write(String(result.contentReady));
  } else {
    process.stdout.write(result.notes);
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}
