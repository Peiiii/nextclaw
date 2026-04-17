import { createHash, sign } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import JSZip from "jszip";
import { resolveMinimumLauncherVersionForChannel } from "./launcher-compatibility.service.mjs";

function serializeUnsignedManifest(manifest) {
  return JSON.stringify({
    channel: manifest.channel,
    platform: manifest.platform,
    arch: manifest.arch,
    latestVersion: manifest.latestVersion,
    minimumLauncherVersion: manifest.minimumLauncherVersion,
    bundleUrl: manifest.bundleUrl,
    bundleSha256: manifest.bundleSha256,
    bundleSignature: manifest.bundleSignature,
    releaseNotesUrl: manifest.releaseNotesUrl
  });
}

export async function cloneBundleWithVersionAndLauncherFloor({
  sourceArchivePath,
  targetArchivePath,
  nextVersion,
  minimumLauncherVersion
}) {
  const archive = await JSZip.loadAsync(readFileSync(sourceArchivePath));
  const manifestEntry =
    archive.file("bundle/manifest.json") ??
    Object.values(archive.files).find((entry) => entry.name.endsWith("/manifest.json"));
  if (!manifestEntry) {
    throw new Error(`Bundle archive is missing manifest.json: ${sourceArchivePath}`);
  }
  const manifest = JSON.parse(await manifestEntry.async("text"));
  manifest.bundleVersion = nextVersion;
  manifest.uiVersion = nextVersion;
  manifest.runtimeVersion = nextVersion;
  manifest.builtInPluginSetVersion = nextVersion;
  manifest.launcherCompatibility = {
    ...(manifest.launcherCompatibility && typeof manifest.launcherCompatibility === "object"
      ? manifest.launcherCompatibility
      : {}),
    minVersion: minimumLauncherVersion
  };
  archive.file(manifestEntry.name, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(targetArchivePath, await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

export function createSignedUpdateManifest({
  privateKey,
  channel,
  version,
  bundlePath,
  bundleUrl,
  releaseNotesUrl,
  minimumLauncherVersion,
  platform = process.platform,
  arch = process.arch
}) {
  const bundleBytes = readFileSync(bundlePath);
  const manifest = {
    channel,
    platform,
    arch,
    latestVersion: version,
    minimumLauncherVersion,
    bundleUrl,
    bundleSha256: createHash("sha256").update(bundleBytes).digest("hex"),
    bundleSignature: sign(null, bundleBytes, privateKey).toString("base64"),
    releaseNotesUrl
  };
  return {
    ...manifest,
    manifestSignature: sign(null, Buffer.from(serializeUnsignedManifest(manifest)), privateKey).toString("base64")
  };
}

export async function prepareLocalUpdateChannelArtifacts({
  stableSeedBundlePath,
  stableVersion,
  betaVersion,
  stableRoot,
  betaRoot,
  manifestBaseUrl,
  privateKey,
  platform = process.platform,
  arch = process.arch
}) {
  const stableMinimumLauncherVersion = resolveMinimumLauncherVersionForChannel("stable");
  const betaMinimumLauncherVersion = resolveMinimumLauncherVersionForChannel("beta");
  const stableBundlePath = join(stableRoot, `nextclaw-bundle-${stableVersion}.zip`);
  const betaBundlePath = join(betaRoot, `nextclaw-bundle-${betaVersion}.zip`);

  copyFileSync(stableSeedBundlePath, stableBundlePath);
  await cloneBundleWithVersionAndLauncherFloor({
    sourceArchivePath: stableSeedBundlePath,
    targetArchivePath: betaBundlePath,
    nextVersion: betaVersion,
    minimumLauncherVersion: betaMinimumLauncherVersion
  });

  const stableBundleUrl = `${manifestBaseUrl}/stable/${basename(stableBundlePath)}`;
  const betaBundleUrl = `${manifestBaseUrl}/beta/${basename(betaBundlePath)}`;
  const stableReleaseNotesUrl = `${manifestBaseUrl}/stable/release-notes-${stableVersion}.txt`;
  const betaReleaseNotesUrl = `${manifestBaseUrl}/beta/release-notes-${betaVersion}.txt`;
  const manifestAssetName = (channel) => `manifest-${channel}-${platform}-${arch}.json`;

  writeFileSync(join(stableRoot, `release-notes-${stableVersion}.txt`), `NextClaw stable ${stableVersion}\n`, "utf8");
  writeFileSync(join(betaRoot, `release-notes-${betaVersion}.txt`), `NextClaw beta ${betaVersion}\n`, "utf8");
  writeFileSync(
    join(stableRoot, manifestAssetName("stable")),
    `${JSON.stringify(
      createSignedUpdateManifest({
        privateKey,
        channel: "stable",
        version: stableVersion,
        bundlePath: stableBundlePath,
        bundleUrl: stableBundleUrl,
        releaseNotesUrl: stableReleaseNotesUrl,
        minimumLauncherVersion: stableMinimumLauncherVersion,
        platform,
        arch
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  writeFileSync(
    join(betaRoot, manifestAssetName("beta")),
    `${JSON.stringify(
      createSignedUpdateManifest({
        privateKey,
        channel: "beta",
        version: betaVersion,
        bundlePath: betaBundlePath,
        bundleUrl: betaBundleUrl,
        releaseNotesUrl: betaReleaseNotesUrl,
        minimumLauncherVersion: betaMinimumLauncherVersion,
        platform,
        arch
      }),
      null,
      2
    )}\n`,
    "utf8"
  );

  return {
    stableBundlePath,
    betaBundlePath,
    stableMinimumLauncherVersion,
    betaMinimumLauncherVersion
  };
}
