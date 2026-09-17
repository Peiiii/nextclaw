import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DESKTOP_DOWNLOAD_METADATA_SCHEMA,
  buildDesktopDownloadMetadata
} from "./desktop-download-metadata.mjs";

test("builds stable desktop download metadata from the release identity", () => {
  assert.deepEqual(buildDesktopDownloadMetadata({ tag: "v0.57.0-desktop.1", version: "0.0.296" }), {
    schema: DESKTOP_DOWNLOAD_METADATA_SCHEMA,
    tag: "v0.57.0-desktop.1",
    version: "0.0.296",
    url: "https://github.com/Peiiii/nextclaw/releases/tag/v0.57.0-desktop.1",
    assets: {
      macArm64Dmg:
        "https://github.com/Peiiii/nextclaw/releases/download/v0.57.0-desktop.1/NextClaw.Desktop-0.0.296-arm64.dmg",
      macX64Dmg:
        "https://github.com/Peiiii/nextclaw/releases/download/v0.57.0-desktop.1/NextClaw.Desktop-0.0.296-x64.dmg",
      windowsX64Installer:
        "https://github.com/Peiiii/nextclaw/releases/download/v0.57.0-desktop.1/NextClaw.Desktop-Setup-0.0.296-x64.exe",
      linuxX64AppImage:
        "https://github.com/Peiiii/nextclaw/releases/download/v0.57.0-desktop.1/NextClaw.Desktop-0.0.296-linux-x64.AppImage"
    },
    windowsPortableZipUrl:
      "https://github.com/Peiiii/nextclaw/releases/download/v0.57.0-desktop.1/NextClaw-Portable-0.0.296-win-x64.zip"
  });
});

test("rejects beta and malformed desktop identities", () => {
  assert.throws(
    () => buildDesktopDownloadMetadata({ tag: "v0.57.0-desktop-beta.1", version: "0.0.296" }),
    /tag is invalid/u
  );
  assert.throws(
    () => buildDesktopDownloadMetadata({ tag: "v0.57.0-desktop.1", version: "0.0.296-beta.1" }),
    /version is invalid/u
  );
});

test("stable desktop publication writes the website metadata into release state", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/desktop-release.yml", import.meta.url), "utf8");
  assert.match(
    workflow,
    /publish-desktop-update-channels:[\s\S]*?needs: \[build-desktop, publish-release-assets, publish-github-release\]/u
  );
  assert.match(
    workflow,
    /if \[ "\$DESKTOP_UPDATE_CHANNEL" = "stable" \]; then[\s\S]*?desktop-download-metadata\.mjs[\s\S]*?desktop-downloads\/stable\.json/u
  );
  assert.match(workflow, /git -C \.tmp\/gh-pages add desktop-downloads\/stable\.json/u);
});
