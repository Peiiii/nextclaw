import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppManifest } from "../manifest/app-manifest.types.js";
import { AppMarketplaceMetadataService } from "./app-marketplace-metadata.service.js";

describe("AppMarketplaceMetadataService", () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      cleanupPaths.map((entryPath) =>
        rm(entryPath, {
          recursive: true,
          force: true,
        }),
      ),
    );
    cleanupPaths.length = 0;
  });

  it("loads metadata and collects publish files", async () => {
    const appDirectory = await mkdtemp(path.join(tmpdir(), "napp-publish-meta-"));
    cleanupPaths.push(appDirectory);
    const metadataPath = path.join(appDirectory, "marketplace.json");
    const readmePath = path.join(appDirectory, "README.md");
    await writeFile(
      metadataPath,
      `${JSON.stringify(
        {
          slug: "hello-notes",
          summary: "Hello Notes",
          summaryI18n: {
            en: "Hello Notes",
            zh: "你好笔记",
          },
          description: "Demo",
          descriptionI18n: {
            en: "Demo",
            zh: "示例",
          },
          author: "NextClaw",
          tags: ["official", "notes"],
          sourceRepo: "https://github.com/Peiiii/nextclaw",
          homepage: "https://nextclaw.io",
          featured: true,
          publisher: {
            id: "nextclaw",
            name: "NextClaw",
            url: "https://nextclaw.io",
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(readmePath, "# Hello Notes\n");

    const manifest: AppManifest = {
      schemaVersion: 1,
      id: "nextclaw.hello-notes",
      name: "Hello Notes",
      version: "0.1.0",
      main: {
        kind: "wasm",
        entry: "main/app.wasm",
        export: "summarize_notes",
        action: "summarizeNotes",
      },
      ui: {
        entry: "ui/index.html",
      },
      permissions: {},
    };

    const service = new AppMarketplaceMetadataService();
    await expect(service.load({ appDirectory, manifest })).resolves.toMatchObject({
      slug: "hello-notes",
      author: "NextClaw",
      featured: true,
      tags: ["official", "notes"],
    });
    await expect(service.collectPublishFiles({ appDirectory })).resolves.toEqual([
      expect.objectContaining({
        path: "marketplace.json",
      }),
      expect.objectContaining({
        path: "README.md",
      }),
    ]);
  });
});
