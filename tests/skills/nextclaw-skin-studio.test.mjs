import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scriptPath = join(repositoryRoot, "skills/nextclaw-skin-studio/scripts/skin.mjs");

function run(args, home = mkdtempSync(join(tmpdir(), "nextclaw-skin-test-"))) {
  const result = spawnSync(process.execPath, [scriptPath, ...args, "--home", home], {
    encoding: "utf8",
  });
  return { ...result, home };
}

test("lists a useful built-in skin catalog", () => {
  const result = run(["list", "--json"]);

  assert.equal(result.status, 0, result.stderr);
  const skins = JSON.parse(result.stdout);
  assert.deepEqual(
    skins.map((skin) => skin.id),
    [
      "abyssal-compass",
      "portal-red",
      "rose-quartz",
      "glass-tide",
      "violet-orbit",
      "noir-gold",
    ],
  );
});

test("applies the selected skin and reports its status", () => {
  const applied = run(["apply", "violet-orbit"]);

  assert.equal(applied.status, 0, applied.stderr);
  const injectionPath = join(applied.home, "ui-inject.js");
  const injection = readFileSync(injectionPath, "utf8");
  assert.match(injection, /nextclaw-ui-skin-owner: nextclaw-skin-studio/);
  assert.match(injection, /nextclaw-ui-skin-id: violet-orbit/);

  const status = run(["status", "--json"], applied.home);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).skinId, "violet-orbit");
});

test("creates a custom skin from a built-in base and optional local image", () => {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-skin-custom-"));
  const imagePath = join(home, "hero.png");
  writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const result = run([
    "custom",
    "--name", "My Aurora",
    "--base", "glass-tide",
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

  const result = run(["apply", "portal-red"], home);

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

  const applied = run(["apply", "portal-red"], home);
  assert.equal(applied.status, 0, applied.stderr);

  const removed = run(["remove"], home);
  assert.equal(removed.status, 0, removed.stderr);
  const status = run(["status", "--json"], home);
  assert.equal(JSON.parse(status.stdout).state, "inactive");
});
