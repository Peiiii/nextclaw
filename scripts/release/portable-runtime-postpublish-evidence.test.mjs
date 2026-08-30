import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

test("postpublish evidence verifies public NPM, Runtime, Desktop, APT and documentation before PRT-REL", async () => {
  const script = await readFile(path.join(root, "scripts/release/portable-runtime-postpublish-evidence.ts"), "utf8");
  for (const expected of [
    "npm", "nextclaw@latest", "nextclaw-runtime-", "npm-runtime-updates",
    "desktop-updates", "manifest-stable-${platform}-${arch}.json", "/apt/dists/stable/main/binary-amd64/Packages",
    "docs.nextclaw.io", "PRT-REL-001", "assertPrepublishCandidate", "assertPostpublishCandidate",
    "findStableDesktopRelease", "tagPattern", "NextClaw.Desktop-${desktopVersion}-arm64.dmg",
    "NextClaw.Desktop-Setup-${desktopVersion}-x64.exe", "NextClaw.Desktop-${desktopVersion}-linux-x64.AppImage",
  ]) assert.match(script, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("full release runs public postpublish verification after the same identity desktop closure", async () => {
  const workflow = await readFile(path.join(root, ".github/workflows/release.yml"), "utf8");
  assert.match(workflow, /verify-portable-runtime-postpublish:[\s\S]*?needs: \[publish-npm, publish-runtime, publish-desktop\]/);
  assert.match(workflow, /Download exact candidate evidence/);
  assert.match(workflow, /portable-runtime-postpublish-evidence\.ts/);
  assert.match(workflow, /release:portable-runtime:acceptance:validate:postpublish/);
  assert.match(workflow, /PORTABLE_RUNTIME_POSTPUBLISH_RESULT/);
});

test("release identity resolves new and recovery paths before reusable validation", async () => {
  const workflow = await readFile(path.join(root, ".github/workflows/release.yml"), "utf8");
  assert.match(workflow, /resolve-release-identity:/);
  assert.match(workflow, /mode=new/);
  assert.match(workflow, /mode=recovery/);
  assert.match(workflow, /needs: resolve-release-identity[\s\S]*?portable-runtime-validate/);
  assert.match(workflow, /RELEASE_TARGET_VERSION: \$\{\{ needs\.resolve-release-identity\.outputs\.target_version \}\}/);
  assert.doesNotMatch(workflow, /target_version="\$\(node -p "require\('\.\/packages\/nextclaw\/package\.json'\)\.version"\)/);

  const validation = await readFile(path.join(root, ".github/workflows/portable-runtime-validate.yml"), "utf8");
  assert.match(validation, /release_mode:/);
  assert.match(validation, /already-consumed Changesets plan/);
  assert.match(validation, /value: \$\{\{ jobs\.select-matrix\.outputs\.product_version \}\}/);
});
