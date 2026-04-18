import { access, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppScaffoldService } from "../scaffold/app-scaffold.service.js";
import { AppBundleService } from "./app-bundle.service.js";

describe("AppBundleService", () => {
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

  it("packs and extracts a starter app bundle", async () => {
    const appDirectory = path.join(
      tmpdir(),
      `napp-bundle-app-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const bundlePath = path.join(
      tmpdir(),
      `napp-bundle-${Date.now()}-${Math.random().toString(16).slice(2)}.napp`,
    );
    const extractedDirectory = path.join(
      tmpdir(),
      `napp-extracted-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    cleanupPaths.push(appDirectory, bundlePath, extractedDirectory);

    await new AppScaffoldService().scaffold(appDirectory);
    const bundleService = new AppBundleService();
    const packed = await bundleService.packAppDirectory({
      appDirectory,
      outputPath: bundlePath,
    });
    const extracted = await bundleService.extractBundle({
      bundlePath,
      targetDirectory: extractedDirectory,
    });

    await expect(access(bundlePath)).resolves.toBeUndefined();
    await expect(access(path.join(extractedDirectory, ".napp", "checksums.json"))).resolves.toBeUndefined();
    expect(packed.metadata.appId.startsWith("nextclaw.napp-bundle-app-")).toBe(true);
    expect(extracted.metadata.appId).toBe(packed.metadata.appId);
    const bundleJson = JSON.parse(
      await readFile(path.join(extractedDirectory, ".napp", "bundle.json"), "utf-8"),
    ) as { checksumsFile: string };
    expect(bundleJson.checksumsFile).toBe(".napp/checksums.json");
  });
});
