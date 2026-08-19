import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertDesktopGithubReleaseNotes } from "./desktop-release-notes.mjs";

const validNotes = `# NextClaw Desktop 0.0.252

## 中文

本次正式版带来新的会话工作台与多项稳定性修复。

[完整中文更新说明](https://docs.nextclaw.io/zh/notes/2026-08-15-nextclaw-v0-37-0)

## English

This stable release introduces a new session workspace and several reliability fixes.

[Full release notes](https://docs.nextclaw.io/en/notes/2026-08-15-nextclaw-v0-37-0)
`;

function validate(notes, overrides = {}) {
  return () => assertDesktopGithubReleaseNotes({ channel: "stable", notes, notesFile: "github-release.md", ...overrides });
}

test("accepts a GitHub-ready bilingual stable release body", () => {
  assert.doesNotThrow(validate(validNotes));
});

test("requires a dedicated notes file for stable releases", () => {
  assert.throws(validate(validNotes, { notesFile: null }), /requires --notes-file/);
});

test("requires Chinese before English", () => {
  const reversed = validNotes.replace("## 中文", "## Temp").replace("## English", "## 中文").replace("## Temp", "## English");
  assert.throws(validate(reversed), /followed by/);
});

test("rejects documentation frontmatter", () => {
  assert.throws(validate(`---\ntitle: Release\n---\n${validNotes}`), /frontmatter/);
});

test("rejects relative links", () => {
  assert.throws(validate(validNotes.replace("https://docs.nextclaw.io/zh/notes/", "/zh/notes/")), /absolute public URLs/);
});

test("rejects auto-generated GitHub commit noise", () => {
  assert.throws(validate(`${validNotes}\n## What's Changed\n\n* Internal change`), /auto-generated/);
});

test("leaves beta release notes outside the stable bilingual contract", () => {
  assert.doesNotThrow(validate("Preview build", { channel: "beta", notesFile: null }));
});

test("desktop asset upload does not append generated release notes", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/desktop-release.yml", import.meta.url), "utf8");
  assert.match(workflow, /generate_release_notes: false/);
  assert.doesNotMatch(workflow, /generate_release_notes: true/);
});

test("desktop workflow exposes an explicit APT-only recovery path", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/desktop-release.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /publish_linux_apt_only:\n[\s\S]*?type: boolean/);
  assert.match(
    workflow,
    /Download Linux package from existing release[\s\S]*?gh release download/,
  );
  assert.match(
    workflow,
    /dpkg-deb --root-owner-group --build -Zxz -z9 -Sextreme/,
  );
  assert.match(workflow, /github_file_limit=104857600/);
});
