import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertDesktopGithubReleaseNotes,
  buildDesktopGithubReleaseNotes,
} from "./desktop-release-notes.mjs";

const validNotes = `# NextClaw Desktop 0.0.252

## 中文

本次正式版带来新的会话工作台与多项稳定性修复。

[完整中文更新说明](https://docs.nextclaw.io/zh/notes/2026-08-15-nextclaw-v0-37-0)

## English

This stable release introduces a new session workspace and several reliability fixes.

[Full release notes](https://docs.nextclaw.io/en/notes/2026-08-15-nextclaw-v0-37-0)
`;

function validate(notes, overrides = {}) {
  return () =>
    assertDesktopGithubReleaseNotes({
      channel: "stable",
      notes,
      notesFile: "github-release.md",
      ...overrides,
    });
}

const structuredReleaseNotes = {
  version: "0.43.0",
  channel: "stable",
  summary: {
    "zh-CN": "让每次 AI 运行都可追溯。",
    "en-US": "Makes every AI run traceable.",
  },
  links: {
    html: {
      "zh-CN": "https://docs.nextclaw.io/zh/notes/2026-08-25-nextclaw-v0-43-0",
      "en-US": "https://docs.nextclaw.io/en/notes/2026-08-25-nextclaw-v0-43-0",
    },
  },
  sections: [
    {
      items: [
        {
          title: { "zh-CN": "运行触发详情", "en-US": "Run trigger details" },
          body: {
            "zh-CN": "消息中会显示触发来源。",
            "en-US": "Messages show their trigger source.",
          },
        },
      ],
    },
  ],
};

test("accepts a GitHub-ready bilingual stable release body", () => {
  assert.doesNotThrow(validate(validNotes));
});

test("requires an explicit or structured stable release-note source", () => {
  assert.throws(
    validate(validNotes, { notesFile: null }),
    /requires --notes-file or exact-version/,
  );
});

test("builds a bilingual GitHub body from exact-version structured release notes", () => {
  const notes = buildDesktopGithubReleaseNotes({
    expectedVersion: "0.43.0",
    metadata: structuredReleaseNotes,
  });
  assert.match(notes, /^# NextClaw v0\.43\.0/m);
  assert.match(
    notes,
    /## 中文[\s\S]*运行触发详情[\s\S]*https:\/\/docs\.nextclaw\.io\/zh\/notes\//,
  );
  assert.match(
    notes,
    /## English[\s\S]*Run trigger details[\s\S]*https:\/\/docs\.nextclaw\.io\/en\/notes\//,
  );
  assert.doesNotThrow(
    validate(notes, {
      notesFile: null,
      structuredReleaseNotesPath:
        "apps/docs/public/release-notes/nextclaw-v0.43.0.json",
    }),
  );
});

test("rejects structured release notes for a different version", () => {
  assert.throws(
    () =>
      buildDesktopGithubReleaseNotes({
        expectedVersion: "0.43.1",
        metadata: structuredReleaseNotes,
      }),
    /version mismatch/,
  );
});

test("stable Desktop generation reads structured notes from the immutable target", () => {
  const releaseScript = readFileSync(
    new URL("./release-desktop.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    releaseScript,
    /readTargetFile\(\s*options\.target,\s*structuredReleaseNotesPath,?\s*\)/,
  );
  assert.doesNotMatch(
    releaseScript,
    /readJsonFile\(structuredReleaseNotesPath\)/,
  );
});

test("requires Chinese before English", () => {
  const reversed = validNotes
    .replace("## 中文", "## Temp")
    .replace("## English", "## 中文")
    .replace("## Temp", "## English");
  assert.throws(validate(reversed), /followed by/);
});

test("rejects documentation frontmatter", () => {
  assert.throws(
    validate(`---\ntitle: Release\n---\n${validNotes}`),
    /frontmatter/,
  );
});

test("rejects relative links", () => {
  assert.throws(
    validate(
      validNotes.replace("https://docs.nextclaw.io/zh/notes/", "/zh/notes/"),
    ),
    /absolute public URLs/,
  );
});

test("rejects auto-generated GitHub commit noise", () => {
  assert.throws(
    validate(`${validNotes}\n## What's Changed\n\n* Internal change`),
    /auto-generated/,
  );
});

test("leaves beta release notes outside the stable bilingual contract", () => {
  assert.doesNotThrow(
    validate("Preview build", { channel: "beta", notesFile: null }),
  );
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
  assert.match(workflow, /timeout 180s sudo apt-get update/);
  assert.match(workflow, /failed after 3 bounded attempts/);
});
