import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { collectReleaseSummary } from "./release-summary.mjs";

function createFixture() {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-release-summary-"));
  mkdirSync(join(rootDir, ".changeset"), { recursive: true });
  mkdirSync(join(rootDir, "images/screenshots"), { recursive: true });
  return rootDir;
}

function writeChangeset(rootDir, id, body) {
  writeFileSync(
    join(rootDir, ".changeset", `${id}.md`),
    `---\n"@nextclaw/ui": minor\n---\n\n${body}\n`
  );
}

test("collects localized release-note images from pending changesets", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  writeFileSync(join(rootDir, "images/screenshots/inbox-cn.png"), "image");
  writeChangeset(
    rootDir,
    "inbox",
    [
      "新增 AI 主动送达收件箱。",
      "<!-- release-note-image: zh-CN | images/screenshots/inbox-cn.png | AI 主动送达项目晨报 -->"
    ].join("\n")
  );

  assert.deepEqual(collectReleaseSummary(rootDir), {
    schemaVersion: 1,
    changesets: [
      {
        id: "inbox",
        file: ".changeset/inbox.md",
        packages: [{ name: "@nextclaw/ui", bump: "minor" }],
        summary: "新增 AI 主动送达收件箱。",
        images: [
          {
            locale: "zh-CN",
            sourcePath: "images/screenshots/inbox-cn.png",
            alt: "AI 主动送达项目晨报"
          }
        ]
      }
    ],
    images: [
      {
        changesetId: "inbox",
        locale: "zh-CN",
        sourcePath: "images/screenshots/inbox-cn.png",
        alt: "AI 主动送达项目晨报"
      }
    ],
    errors: []
  });
});

test("ignores changesets already applied in prerelease state", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  writeChangeset(rootDir, "applied", "已经进入预发布版本。\n");
  writeFileSync(
    join(rootDir, ".changeset", "pre.json"),
    JSON.stringify({ changesets: ["applied"] })
  );

  assert.deepEqual(collectReleaseSummary(rootDir).changesets, []);
});

test("reports malformed, missing, and out-of-root images", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  writeChangeset(
    rootDir,
    "broken",
    [
      "损坏的图片合同。",
      "<!-- release-note-image: zh-CN | missing-alt -->",
      "<!-- release-note-image: en-US | docs/private.png | Private image -->"
    ].join("\n")
  );

  const summary = collectReleaseSummary(rootDir);
  assert.equal(summary.images.length, 1);
  assert.equal(summary.errors.length, 3);
  assert.match(summary.errors[0], /malformed release-note image directive/);
  assert.match(summary.errors[1], /must live under images\/screenshots\//);
  assert.match(summary.errors[2], /does not exist: docs\/private\.png/);
});
