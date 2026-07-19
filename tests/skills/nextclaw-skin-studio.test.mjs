import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scriptPath = join(repositoryRoot, "skills/nextclaw-skin-studio/scripts/skin.mjs");
const catalogPath = join(repositoryRoot, "skills/nextclaw-skin-studio/assets/skins.json");

function run(args, home = mkdtempSync(join(tmpdir(), "nextclaw-skin-test-"))) {
  const result = spawnSync(process.execPath, [scriptPath, ...args, "--home", home], {
    encoding: "utf8",
  });
  return { ...result, home };
}

function createImage(home, name = "hero.png") {
  const imagePath = join(home, name);
  writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return imagePath;
}

test("lists a useful built-in skin catalog", () => {
  const result = run(["list", "--json"]);

  assert.equal(result.status, 0, result.stderr);
  const skins = JSON.parse(result.stdout);
  assert.deepEqual(
    skins.map((skin) => skin.id),
    [
      "jackson-yee",
      "arina-hashimoto",
      "dilraba-violet",
      "miku-cyan",
      "kun-noir",
      "jinx-pop",
      "enfp-spark",
      "people-ai-red",
      "god-of-wealth",
      "pink-custom",
      "gothic-void-crusade",
    ],
  );
  assert.match(skins[0].previewUrl, /3af1d6d62f3a0388cc640d2f497ac3100998938e/);
  assert.equal(skins[0].upstreamLabel, "Jackson Yee · 清透定制");
});

test("applies the selected skin and reports its status", () => {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-skin-apply-"));
  const imagePath = createImage(home);
  const applied = run(["apply", "jackson-yee", "--image", imagePath], home);

  assert.equal(applied.status, 0, applied.stderr);
  const injectionPath = join(applied.home, "ui-inject.js");
  const injection = readFileSync(injectionPath, "utf8");
  assert.match(injection, /nextclaw-ui-skin-owner: nextclaw-skin-studio/);
  assert.match(injection, /nextclaw-ui-skin-id: jackson-yee/);
  assert.match(injection, /易烊千玺/);
  assert.match(injection, /data:image\/png;base64/);
  assert.match(injection, /class SkinRuntime/);
  assert.match(injection, /session-item/);
  assert.match(injection, /collection-section/);
  assert.match(injection, /settings-section/);
  assert.match(injection, /URL\.createObjectURL/);
  assert.match(injection, /__NEXTCLAW_SKIN_STYLE_FACTORIES__/);
  assert.match(injection, /NextClaw skin style assets are incomplete/);
  assert.match(injection, /sidebar\?\.querySelectorAll\("svg\.animate-spin"\)/);
  assert.match(injection, /if \(element\.dataset\.skinRole !== role\) element\.dataset\.skinRole = role/);
  assert.match(injection, /if \(!this\.roleTargets\.has\(element\)\)/);
  assert.match(injection, /nextclaw-skin-dragon-swim/);
  assert.match(injection, /auto clamp\(820px, 108vh, 1320px\)/);
  assert.match(injection, /width: 30px !important/);
  const layerOrder = [
    injection.indexOf("return `\n    :root.nextclaw-skin-studio"),
    injection.indexOf('return `    html.nextclaw-skin-studio [data-skin-role="shell"]'),
    injection.indexOf('return `    html.nextclaw-skin-studio [data-skin-role="page"]'),
    injection.indexOf('return `    html.nextclaw-skin-studio [data-skin-role="chat-header"]'),
    injection.indexOf("class SkinRuntime"),
  ];
  assert.ok(layerOrder.every((index) => index >= 0));
  assert.deepEqual(layerOrder, [...layerOrder].sort((left, right) => left - right));

  const status = run(["status", "--json"], applied.home);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).skinId, "jackson-yee");
});

test("creates a custom skin from a built-in base and optional local image", () => {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-skin-custom-"));
  const imagePath = createImage(home);

  const result = run([
    "custom",
    "--name", "My Aurora",
    "--base", "gothic-void-crusade",
    "--accent", "#22d3ee",
    "--secondary", "#a78bfa",
    "--image", imagePath,
  ], home);

  assert.equal(result.status, 0, result.stderr);
  const injection = readFileSync(join(home, "ui-inject.js"), "utf8");
  assert.match(injection, /nextclaw-ui-skin-id: custom-my-aurora/);
  assert.match(injection, /#22d3ee/);
  assert.match(injection, /data:image\/png;base64/);
});

test("does not overwrite an injection owned by another tool", () => {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-skin-conflict-"));
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, "ui-inject.js"), "// another tool\n");

  const result = run(["apply", "jackson-yee"], home);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /another tool|not owned/i);
  assert.equal(readFileSync(join(home, "ui-inject.js"), "utf8"), "// another tool\n");
});

test("migrates and removes the released legacy Abyssal Compass injection", () => {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-skin-legacy-"));
  writeFileSync(
    join(home, "ui-inject.js"),
    "// nextclaw-ui-theme-id: abyssal-compass-theme\n",
  );

  const imagePath = createImage(home);
  const applied = run(["apply", "jackson-yee", "--image", imagePath], home);
  assert.equal(applied.status, 0, applied.stderr);

  const removed = run(["remove"], home);
  assert.equal(removed.status, 0, removed.stderr);
  const status = run(["status", "--json"], home);
  assert.equal(JSON.parse(status.stdout).state, "inactive");
});

test("fails instead of substituting an upstream asset with the wrong digest", () => {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-skin-integrity-"));
  const sourceDirectory = join(home, "upstream");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const jacksonYee = catalog.skins.find((skin) => skin.id === "jackson-yee");
  const sourcePath = join(sourceDirectory, jacksonYee.asset.path);
  mkdirSync(dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, "not the pinned upstream image");

  const result = run(["apply", "jackson-yee", "--source-dir", sourceDirectory], home);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /integrity check failed/i);
  assert.equal(existsSync(join(home, "ui-inject.js")), false);
});
