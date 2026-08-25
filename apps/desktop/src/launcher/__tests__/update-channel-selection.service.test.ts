import assert from "node:assert/strict";
import test from "node:test";
import { DesktopUpdateService } from "../services/update.service";
import { DesktopBundleLayoutStore } from "../stores/bundle-layout.store";
import { bundlePublicKey, createSignedUpdateManifest } from "./launcher-test.utils";

function createUpdateServiceWithManifests(betaVersion: string, stableVersion: string): {
  service: DesktopUpdateService;
  betaManifest: ReturnType<typeof createSignedUpdateManifest>;
  stableManifest: ReturnType<typeof createSignedUpdateManifest>;
} {
  const betaManifest = createSignedUpdateManifest({
    channel: "beta",
    latestVersion: betaVersion
  });
  const stableManifest = createSignedUpdateManifest({
    channel: "stable",
    latestVersion: stableVersion
  });
  return {
    service: new DesktopUpdateService({
      layout: new DesktopBundleLayoutStore("/tmp/nextclaw-update-channel-selection"),
      launcherVersion: "0.1.0",
      bundlePublicKey,
      platform: "darwin",
      arch: "arm64",
      resolveChannel: () => "beta",
      fetchImpl: async (url) =>
        new Response(JSON.stringify(String(url).includes("stable") ? stableManifest : betaManifest), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
    }),
    betaManifest,
    stableManifest
  };
}

const BETA_SOURCES = [
  { channel: "beta", url: "https://example.com/beta-manifest.json" },
  { channel: "stable", url: "https://example.com/stable-manifest.json" }
] as const;

test("beta update checks select a newer stable manifest", async () => {
  const { service, stableManifest } = createUpdateServiceWithManifests("0.42.0", "0.43.0");

  const result = await service.checkForUpdates([...BETA_SOURCES], "0.42.0");

  assert.deepEqual(result, {
    kind: "bundle-update",
    manifest: stableManifest
  });
});

test("beta update checks keep a newer beta manifest", async () => {
  const { service, betaManifest } = createUpdateServiceWithManifests("0.44.0", "0.43.0");

  const result = await service.checkForUpdates([...BETA_SOURCES], "0.43.0");

  assert.deepEqual(result, {
    kind: "bundle-update",
    manifest: betaManifest
  });
});

test("multi-source update checks reject a manifest from the wrong channel", async () => {
  const betaManifest = createSignedUpdateManifest({
    channel: "beta",
    latestVersion: "0.44.0"
  });
  const updateClient = new DesktopUpdateService({
    layout: new DesktopBundleLayoutStore("/tmp/nextclaw-update-channel-mismatch"),
    launcherVersion: "0.1.0",
    bundlePublicKey,
    platform: "darwin",
    arch: "arm64",
    fetchImpl: async () =>
      new Response(JSON.stringify(betaManifest), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
  });

  await assert.rejects(
    async () =>
      await updateClient.checkForUpdates(
        [{ channel: "stable", url: "https://example.com/stable-manifest.json" }],
        "0.43.0"
      ),
    /update manifest channel mismatch: expected stable but got beta/
  );
});
