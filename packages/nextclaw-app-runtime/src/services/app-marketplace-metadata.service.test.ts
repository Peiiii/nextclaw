import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppManifest } from "#app-runtime/types/app-manifest.types.js";
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
    const iconPath = path.join(appDirectory, "assets", "icon.svg");
    const coverPath = path.join(appDirectory, "marketplace-assets", "cover.webp");
    await mkdir(path.dirname(iconPath), { recursive: true });
    await mkdir(path.dirname(coverPath), { recursive: true });
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
          visuals: {
            cover: "marketplace-assets/cover.webp",
            accentColor: "#746d59",
          },
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
    await writeFile(iconPath, "<svg />");
    await writeFile(coverPath, Buffer.from("cover"));

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
      visuals: {
        cover: "marketplace-assets/cover.webp",
        accentColor: "#746D59",
      },
    });
    await expect(service.collectPublishFiles({
      appDirectory,
      iconPath: "assets/icon.svg",
      visuals: {
        cover: "marketplace-assets/cover.webp",
        accentColor: "#746D59",
      },
    })).resolves.toEqual([
      expect.objectContaining({
        path: "marketplace.json",
      }),
      expect.objectContaining({
        path: "README.md",
      }),
      expect.objectContaining({
        path: "assets/icon.svg",
      }),
      expect.objectContaining({
        path: "marketplace-assets/cover.webp",
        bytes: Buffer.from("cover"),
      }),
    ]);
  });

  it("rejects unsafe or unsupported cover artwork", async () => {
    const service = new AppMarketplaceMetadataService();
    const manifest = {
      schemaVersion: 1,
      id: "nextclaw.hello-notes",
      name: "Hello Notes",
      version: "0.1.0",
      main: { kind: "wasi-http-component", entry: "main/app.wasm" },
      ui: { entry: "ui/index.html" },
    } satisfies AppManifest;
    const appDirectory = await mkdtemp(path.join(tmpdir(), "napp-publish-meta-invalid-"));
    cleanupPaths.push(appDirectory);
    await writeFile(path.join(appDirectory, "marketplace.json"), JSON.stringify({
      slug: "hello-notes",
      summary: "Hello Notes",
      summaryI18n: { en: "Hello Notes" },
      tags: ["notes"],
      visuals: { cover: "../cover.svg", accentColor: "purple" },
    }));

    await expect(service.load({ appDirectory, manifest })).rejects.toThrow(
      "visuals.cover 必须是安全的相对路径",
    );
  });
});
