import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppComponentManifest } from "#app-runtime/types/app-manifest.types.js";
import { AppBundleService } from "./app-bundle.service.js";
import { AppManifestService } from "./app-manifest.service.js";
import { AppPublishArtifactService } from "./app-publish-artifact.service.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupPaths.map((entryPath) => rm(entryPath, { recursive: true, force: true })),
  );
  cleanupPaths.length = 0;
});

describe("AppPublishArtifactService", () => {
  it("accepts exactly the one or multiple targets declared by an App version", async () => {
    const { appDirectory, artifactsDirectory, manifest } = await createTargetedApp([
      { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
      { kind: "native", os: "darwin", arch: "arm64" },
    ]);
    const bundleService = new AppBundleService();
    const distribution = manifest.distribution;
    if (!distribution || distribution.mode !== "targeted") {
      throw new Error("expected targeted fixture");
    }
    await Promise.all(distribution.targets.map((target) =>
      bundleService.packAppDirectory({
        appDirectory,
        outputPath: path.join(
          artifactsDirectory,
          `${target.os}-${target.arch}${"abi" in target ? `-${target.abi}` : ""}.napp`,
        ),
        target,
      })));

    const artifacts = await new AppPublishArtifactService().collect({
      manifest,
      artifactsDirectory,
    });

    expect(artifacts.map((artifact) => artifact.targetKey)).toEqual([
      "darwin-arm64",
      "linux-x64-gnu",
    ]);
    expect(artifacts.every((artifact) => artifact.sha256.length === 64)).toBe(true);
  });

  it("rejects publishing when any declared target artifact is missing", async () => {
    const { appDirectory, artifactsDirectory, manifest } = await createTargetedApp([
      { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
      { kind: "native", os: "darwin", arch: "arm64" },
    ]);
    await new AppBundleService().packAppDirectory({
      appDirectory,
      outputPath: path.join(artifactsDirectory, "linux-x64-gnu.napp"),
      target: { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
    });

    await expect(new AppPublishArtifactService().collect({
      manifest,
      artifactsDirectory,
    })).rejects.toThrow("声明 targets 与上传 artifacts 不一致");
  });
});

async function createTargetedApp(
  targets: Extract<AppComponentManifest["distribution"], { mode: "targeted" }>["targets"],
): Promise<{
  appDirectory: string;
  artifactsDirectory: string;
  manifest: AppComponentManifest;
}> {
  const workspaceDirectory = await mkdtemp(path.join(tmpdir(), "napp-targeted-publish-"));
  cleanupPaths.push(workspaceDirectory);
  const appDirectory = path.join(workspaceDirectory, "app");
  const artifactsDirectory = path.join(workspaceDirectory, "dist");
  await cp(
    path.resolve(
      import.meta.dirname,
      "../../../nextclaw/resources/apps/nextclaw-personal-organizer",
    ),
    appDirectory,
    { recursive: true },
  );
  const manifestPath = path.join(appDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as AppComponentManifest;
  manifest.distribution = { mode: "targeted", targets };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  const loaded = await new AppManifestService().load(appDirectory);
  if (loaded.manifest.schemaVersion !== 2) {
    throw new Error("expected schema v2 fixture");
  }
  return { appDirectory, artifactsDirectory, manifest: loaded.manifest };
}
