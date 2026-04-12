import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  DesktopUpdateSourceService,
  getDesktopUpdateManifestAssetName
} from "./desktop-update-source.service";

async function withTempDir(prefix: string, job: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), prefix));
  await job(rootDir);
}

test("stable packaged apps resolve the latest stable manifest URL by default", async () =>
  await withTempDir("nextclaw-update-source-stable-", async (rootDir) => {
    const service = new DesktopUpdateSourceService({
      isPackaged: true,
      appPath: rootDir,
      resourcesPath: rootDir,
      platform: "darwin",
      arch: "arm64",
      publishTarget: {
        owner: "Peiiii",
        repo: "nextclaw"
      }
    });

    const manifestUrl = await service.resolveManifestUrl();
    assert.equal(
      manifestUrl,
      "https://github.com/Peiiii/nextclaw/releases/latest/download/manifest-stable-darwin-arm64.json"
    );
    assert.equal(service.resolveChannel(), "stable");
  }));

test("beta packaged apps resolve the latest beta manifest asset from GitHub releases", async () =>
  await withTempDir("nextclaw-update-source-beta-", async (rootDir) => {
    const resourcesPath = join(rootDir, "resources");
    await mkdir(join(resourcesPath, "update"), { recursive: true });
    await writeFile(
      join(resourcesPath, "update", "update-release-metadata.json"),
      `${JSON.stringify({ channel: "beta", releaseTag: "v0.17.6-desktop-beta.2" }, null, 2)}\n`,
      "utf8"
    );

    const expectedManifestName = getDesktopUpdateManifestAssetName("beta", "darwin", "arm64");
    const service = new DesktopUpdateSourceService({
      isPackaged: true,
      appPath: rootDir,
      resourcesPath,
      platform: "darwin",
      arch: "arm64",
      publishTarget: {
        owner: "Peiiii",
        repo: "nextclaw"
      },
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              draft: false,
              prerelease: true,
              assets: [
                {
                  name: expectedManifestName,
                  browser_download_url: "https://example.com/releases/download/v0.17.7-desktop-beta.1/manifest-beta-darwin-arm64.json"
                }
              ]
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    });

    assert.equal(service.resolveChannel(), "beta");
    assert.equal(
      await service.resolveManifestUrl(),
      "https://example.com/releases/download/v0.17.7-desktop-beta.1/manifest-beta-darwin-arm64.json"
    );
  }));
