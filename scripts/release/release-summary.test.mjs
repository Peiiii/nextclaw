import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ensureReleaseBlogsReady } from "./release-stable-preparation.mjs";
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
    `---\n"@nextclaw/ui": minor\n---\n\n${body}\n`,
  );
}

function writeBlogDraft(rootDir, id, options = {}) {
  const state = options.state ?? "draft";
  const sourcePath = `docs/blog-drafts/${id}.blog-draft.md`;
  mkdirSync(join(rootDir, "docs/blog-drafts"), { recursive: true });
  const readyFields =
    state === "ready"
      ? `releaseBlogZhPath: ${options.zhPath}\nreleaseBlogEnPath: ${options.enPath}\n`
      : "";
  writeFileSync(
    join(rootDir, sourcePath),
    [
      "---",
      `title: ${id}`,
      `releaseBlogTarget: next-stable`,
      `releaseBlogChangeset: ${id}`,
      `releaseBlogState: ${state}`,
      readyFields.trimEnd(),
      "---",
      "",
      `# ${id}`,
      "",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  );
  return sourcePath;
}

function writeReadyBlogSurfaces(rootDir, slug) {
  const zhPath = `apps/docs/zh/blog/${slug}.md`;
  const enPath = `apps/docs/en/blog/${slug}.md`;
  mkdirSync(join(rootDir, "apps/docs/zh/blog"), { recursive: true });
  mkdirSync(join(rootDir, "apps/docs/en/blog"), { recursive: true });
  mkdirSync(join(rootDir, "apps/docs/.vitepress/navigation"), { recursive: true });
  writeFileSync(join(rootDir, zhPath), "# 重载会话\n");
  writeFileSync(join(rootDir, enPath), "# Heavy session\n");
  writeFileSync(join(rootDir, "apps/docs/zh/blog/index.md"), `[重载会话](./${slug})\n`);
  writeFileSync(join(rootDir, "apps/docs/en/blog/index.md"), `[Heavy session](./${slug})\n`);
  writeFileSync(
    join(rootDir, "apps/docs/.vitepress/navigation/docs-navigation.config.ts"),
    `'/zh/blog/${slug}'\n'/en/blog/${slug}'\n`,
  );
  return { zhPath, enPath };
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
      "<!-- release-note-image: zh-CN | images/screenshots/inbox-cn.png | AI 主动送达项目晨报 -->",
    ].join("\n"),
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
            alt: "AI 主动送达项目晨报",
          },
        ],
        blogs: [],
      },
    ],
    images: [
      {
        changesetId: "inbox",
        locale: "zh-CN",
        sourcePath: "images/screenshots/inbox-cn.png",
        alt: "AI 主动送达项目晨报",
      },
    ],
    blogs: [],
    errors: [],
  });
});

test("keeps a linked draft visible and blocking after its changeset is consumed", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const sourcePath = writeBlogDraft(rootDir, "heavy-session");
  writeChangeset(
    rootDir,
    "heavy-session",
    [
      "重载会话改为分级加载。",
      `<!-- release-note-blog: ${sourcePath} -->`,
    ].join("\n"),
  );

  const summary = collectReleaseSummary(rootDir);
  assert.equal(summary.changesets[0].summary, "重载会话改为分级加载。");
  assert.deepEqual(summary.blogs, [
    {
      changesetId: "heavy-session",
      state: "draft",
      target: "next-stable",
      sourcePath,
    },
  ]);
  assert.deepEqual(summary.errors, []);

  writeFileSync(
    join(rootDir, ".changeset/pre.json"),
    JSON.stringify({ changesets: ["heavy-session"] }),
  );
  const strictSummary = collectReleaseSummary(rootDir, { requireReadyBlogs: true });
  assert.equal(strictSummary.changesets.length, 0);
  assert.equal(strictSummary.blogs.length, 1);
  assert.equal(strictSummary.errors.length, 1);
  assert.match(strictSummary.errors[0], /release-note blog is still a draft/);
});

test("accepts a ready bilingual blog after its changeset is consumed", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const paths = writeReadyBlogSurfaces(rootDir, "heavy-session");
  writeBlogDraft(rootDir, "heavy-session", {
    state: "ready",
    zhPath: paths.zhPath,
    enPath: paths.enPath,
  });
  writeChangeset(rootDir, "heavy-session", "重载会话改为分级加载。");
  writeFileSync(
    join(rootDir, ".changeset/pre.json"),
    JSON.stringify({ changesets: ["heavy-session"] }),
  );

  const summary = collectReleaseSummary(rootDir, { requireReadyBlogs: true });
  assert.deepEqual(summary.blogs, [
    {
      changesetId: "heavy-session",
      state: "ready",
      target: "next-stable",
      sourcePath: "docs/blog-drafts/heavy-session.blog-draft.md",
      zhSourcePath: paths.zhPath,
      enSourcePath: paths.enPath,
    },
  ]);
  assert.deepEqual(summary.errors, []);
  assert.doesNotThrow(() => ensureReleaseBlogsReady(rootDir));
});

test("accepts ready blogs exposed through generated dated navigation", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const paths = writeReadyBlogSurfaces(rootDir, "heavy-session");
  writeFileSync(
    join(rootDir, "apps/docs/.vitepress/navigation/docs-navigation.config.ts"),
    [
      "createDatedDirectoryItems('zh', 'blog', (title) => title)",
      "createDatedDirectoryItems('en', 'blog', (title) => title)",
    ].join("\n"),
  );
  writeBlogDraft(rootDir, "heavy-session", {
    state: "ready",
    zhPath: paths.zhPath,
    enPath: paths.enPath,
  });

  const summary = collectReleaseSummary(rootDir, { requireReadyBlogs: true });
  assert.deepEqual(summary.errors, []);
});

test("stable product closure rejects a draft even after its changeset is consumed", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  writeBlogDraft(rootDir, "heavy-session");
  writeChangeset(rootDir, "heavy-session", "重载会话改为分级加载。\n");
  writeFileSync(
    join(rootDir, ".changeset/pre.json"),
    JSON.stringify({ changesets: ["heavy-session"] }),
  );

  assert.throws(
    () => ensureReleaseBlogsReady(rootDir),
    /Stable release blog preparation is incomplete.*still a draft/,
  );
});

test("reports a pending changeset that omits its registered blog directive", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  writeBlogDraft(rootDir, "heavy-session");
  writeChangeset(rootDir, "heavy-session", "重载会话改为分级加载。");

  const summary = collectReleaseSummary(rootDir);
  assert.equal(summary.errors.length, 1);
  assert.match(summary.errors[0], /missing release-note-blog directive/);
});

test("ignores internal blog drafts that are not bound to a release", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  mkdirSync(join(rootDir, "docs/blog-drafts"), { recursive: true });
  writeFileSync(
    join(rootDir, "docs/blog-drafts/future.blog-draft.md"),
    "---\ntitle: Future idea\n---\n\n# Future idea\n",
  );

  const summary = collectReleaseSummary(rootDir, { requireReadyBlogs: true });
  assert.deepEqual(summary.blogs, []);
  assert.deepEqual(summary.errors, []);
});

test("reports malformed and out-of-root blog directives", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  writeChangeset(
    rootDir,
    "broken-blog",
    [
      "损坏的博客合同。",
      "<!-- release-note-blog: draft | docs/private.md -->",
      "<!-- release-note-blog: docs/private.blog-draft.md -->",
    ].join("\n"),
  );

  const summary = collectReleaseSummary(rootDir);
  assert.equal(summary.blogs.length, 0);
  assert.equal(summary.errors.length, 4);
  assert.match(summary.errors[0], /malformed release-note blog directive/);
  assert.match(summary.errors[1], /must live under docs\/blog-drafts/);
  assert.match(summary.errors[2], /does not exist/);
  assert.match(summary.errors[3], /linked blog draft is not registered/);
});

test("ignores changesets already applied in prerelease state", (context) => {
  const rootDir = createFixture();
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  writeChangeset(rootDir, "applied", "已经进入预发布版本。\n");
  writeFileSync(
    join(rootDir, ".changeset/pre.json"),
    JSON.stringify({ changesets: ["applied"] }),
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
      "<!-- release-note-image: en-US | docs/private.png | Private image -->",
    ].join("\n"),
  );

  const summary = collectReleaseSummary(rootDir);
  assert.equal(summary.images.length, 1);
  assert.equal(summary.errors.length, 3);
  assert.match(summary.errors[0], /malformed release-note image directive/);
  assert.match(summary.errors[1], /must live under images\/screenshots\//);
  assert.match(summary.errors[2], /does not exist: docs\/private\.png/);
});
