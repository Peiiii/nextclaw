import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { stageNpmRuntimeUpdateChannelFiles } from "./npm-runtime-update-channel-publisher.mjs";

function writeManifest(rootDir, channel, version, platform = "darwin", arch = "arm64") {
  const fileName = `manifest-${channel}-${platform}-${arch}.json`;
  const filePath = join(rootDir, channel, fileName);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify({
    channel,
    platform,
    arch,
    hostKind: "npm-runtime-bundle",
    latestVersion: version,
    minimumLauncherVersion: "0.18.11",
    bundleUrl: `https://example.test/${version}.zip`,
    bundleSha256: "sha256",
    bundleSignature: "bundle-signature",
    releaseNotesUrl: "https://example.test/notes",
    manifestSignature: "manifest-signature"
  }, null, 2)}\n`);
}

function readVersion(stateDir, channel) {
  const filePath = join(stateDir, "npm-runtime-updates", channel, `manifest-${channel}-darwin-arm64.json`);
  return JSON.parse(readFileSync(filePath, "utf8")).latestVersion;
}

test("stable releases project a newer signed manifest into the beta channel", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-npm-channel-publisher-"));
  const artifactsDir = join(rootDir, "artifacts");
  const stateDir = join(rootDir, "pages");
  writeManifest(artifactsDir, "stable", "0.48.1");
  writeManifest(artifactsDir, "beta", "0.48.1");
  writeManifest(join(stateDir, "npm-runtime-updates"), "beta", "0.48.0-beta.2");

  const events = stageNpmRuntimeUpdateChannelFiles({ artifactsDir, stateDir, releaseChannel: "stable" });

  assert.equal(readVersion(stateDir, "stable"), "0.48.1");
  assert.equal(readVersion(stateDir, "beta"), "0.48.1");
  assert.ok(events.some((event) => event.action === "published-compatibility-projection"));
});

test("stable releases preserve a newer beta manifest", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-npm-channel-preserve-"));
  const artifactsDir = join(rootDir, "artifacts");
  const stateDir = join(rootDir, "pages");
  writeManifest(artifactsDir, "stable", "0.48.1");
  writeManifest(artifactsDir, "beta", "0.48.1");
  writeManifest(join(stateDir, "npm-runtime-updates"), "beta", "0.49.0-beta.1");

  const events = stageNpmRuntimeUpdateChannelFiles({ artifactsDir, stateDir, releaseChannel: "stable" });

  assert.equal(readVersion(stateDir, "beta"), "0.49.0-beta.1");
  assert.ok(events.some((event) => event.action === "preserved-newer-beta-manifest"));
});

test("beta releases only publish their native manifests", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-npm-channel-beta-"));
  const artifactsDir = join(rootDir, "artifacts");
  const stateDir = join(rootDir, "pages");
  writeManifest(artifactsDir, "beta", "0.49.0-beta.1");

  stageNpmRuntimeUpdateChannelFiles({ artifactsDir, stateDir, releaseChannel: "beta" });

  assert.equal(readVersion(stateDir, "beta"), "0.49.0-beta.1");
});

test("stable releases require a matching beta compatibility manifest", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-npm-channel-missing-"));
  const artifactsDir = join(rootDir, "artifacts");
  writeManifest(artifactsDir, "stable", "0.48.1");

  assert.throws(
    () => stageNpmRuntimeUpdateChannelFiles({ artifactsDir, stateDir: join(rootDir, "pages"), releaseChannel: "stable" }),
    /requires one beta compatibility manifest/
  );
});

test("NPM runtime workflow builds and stages stable-to-beta compatibility manifests", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/npm-runtime-update-release.yml", import.meta.url), "utf8");
  assert.match(workflow, /extra_args\+=\(--compatibility-channel beta\)/);
  assert.match(workflow, /compatibility_manifest="dist\/npm-runtime-updates\/beta\/manifest-beta-/);
  assert.match(workflow, /npm-runtime-update-channel-publisher\.mjs/);
  assert.match(workflow, /--artifacts-dir dist\/npm-runtime-updates/);
  assert.match(workflow, /--state-dir \.tmp\/gh-pages/);
  assert.match(workflow, /--release-channel "\$NPM_RUNTIME_UPDATE_CHANNEL"/);
});
