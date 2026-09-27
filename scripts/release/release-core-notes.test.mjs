import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readCoreReleaseNotes, resolveCoreReleaseNotes } from "./release-core-notes.mjs";

test("prepared notes remain bound to their source when content arrives later", () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-notes-source-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init", "-q");
    mkdirSync(join(root, "packages/nextclaw"), { recursive: true });
    writeFileSync(join(root, "packages/nextclaw/CHANGELOG.md"), "# nextclaw\n");
    git("add", ".");
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "prepared source");
    const source = git("rev-parse", "HEAD");
    mkdirSync(join(root, "apps/docs/public/release-notes"), { recursive: true });
    const notesUrl = "https://docs.nextclaw.io/en/notes/v1-2-3";
    writeFileSync(join(root, "apps/docs/public/release-notes/nextclaw-v1.2.3.json"), JSON.stringify({
      version: "1.2.3", links: { html: { "en-US": notesUrl } },
    }));
    git("add", ".");
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "later content");
    assert.equal(readCoreReleaseNotes(root, "1.2.3").releaseNotesUrl, notesUrl);
    assert.equal(readCoreReleaseNotes(root, "1.2.3", "Peiiii/nextclaw", source).releaseNotesUrl,
      "https://github.com/Peiiii/nextclaw/releases/tag/nextclaw@1.2.3");
    assert.equal(readCoreReleaseNotes(root, "1.2.3", "Peiiii/nextclaw", "HEAD").releaseNotesUrl, notesUrl);
    assert.throws(() => readCoreReleaseNotes(root, "1.2.3", "Peiiii/nextclaw", "missing-revision"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("prefers structured release notes for an enriched release", () => {
  const result = resolveCoreReleaseNotes({
    changelog:
      "# nextclaw\n\n## 1.2.3\n\n### Patch Changes\n\n- Fixed update handling.\n",
    structuredMetadata: {
      version: "1.2.3",
      summary: {
        "zh-CN": "更快浏览长文档。",
        "en-US": "Navigate long documents faster.",
      },
      links: {
        html: {
          "zh-CN": "https://docs.nextclaw.io/zh/notes/v1-2-3",
          "en-US": "https://docs.nextclaw.io/en/notes/v1-2-3",
        },
      },
      sections: [
        {
          title: { "zh-CN": "功能", "en-US": "Features" },
          items: [
            {
              title: { "zh-CN": "文档目录", "en-US": "Document outline" },
              body: {
                "zh-CN": "从标题层级直接跳到章节。",
                "en-US": "Jump to a section from the heading hierarchy.",
              },
            },
          ],
        },
      ],
    },
    version: "1.2.3",
  });
  assert.equal(result.contentReady, true);
  assert.equal(
    result.releaseNotesUrl,
    "https://docs.nextclaw.io/en/notes/v1-2-3",
  );
  assert.match(
    result.notes,
    /## 中文[\s\S]*文档目录[\s\S]*https:\/\/docs\.nextclaw\.io\/zh\/[\s\S]*## English[\s\S]*Document outline[\s\S]*https:\/\/docs\.nextclaw\.io\/en\//,
  );
  assert.doesNotMatch(result.notes, /Fixed update handling|may not be ready/);
});

test("rejects structured notes for a different immutable version", () => {
  assert.throws(
    () =>
      resolveCoreReleaseNotes({
        structuredMetadata: {
          version: "1.2.2",
          links: {
            html: { "en-US": "https://docs.nextclaw.io/en/notes/v1-2-2" },
          },
        },
        version: "1.2.3",
      }),
    /version mismatch/,
  );
});

test("falls back to the immutable GitHub release identity without AI content", () => {
  const result = resolveCoreReleaseNotes({
    changelog: "# nextclaw\n",
    repo: "Peiiii/nextclaw",
    version: "1.2.3",
  });
  assert.equal(result.contentReady, false);
  assert.equal(
    result.releaseNotesUrl,
    "https://github.com/Peiiii/nextclaw/releases/tag/nextclaw@1.2.3",
  );
  assert.match(result.notes, /deterministic release pipeline/);
  assert.doesNotMatch(result.notes, /OPENAI|anthropic|model|prompt/i);
});
