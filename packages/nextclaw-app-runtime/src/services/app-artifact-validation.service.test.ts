import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { AppBundleService } from "./app-bundle.service.js";
import { AppManifestService } from "./app-manifest.service.js";
import { AppArtifactValidationService } from "./app-artifact-validation.service.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupPaths.map((entryPath) => rm(entryPath, { force: true })),
  );
  cleanupPaths.length = 0;
});

describe("AppArtifactValidationService", () => {
  it("validates a schema v2 artifact against the publish payload", async () => {
    const appDirectory = path.resolve(
      import.meta.dirname,
      "../../../nextclaw/resources/apps/nextclaw-personal-organizer",
    );
    const bundlePath = path.join(
      tmpdir(),
      `nextclaw-artifact-${Date.now()}-${Math.random().toString(16).slice(2)}.napp`,
    );
    cleanupPaths.push(bundlePath);
    const manifest = (await new AppManifestService().load(appDirectory))
      .manifest;
    const packed = await new AppBundleService().packAppDirectory({
      appDirectory,
      outputPath: bundlePath,
    });

    const result = await new AppArtifactValidationService().validate({
      bytes: new Uint8Array(await readFile(bundlePath)),
      expected: {
        appId: manifest.id,
        name: manifest.name,
        version: manifest.version,
        distributionMode: "bundle",
        manifest,
      },
    });

    expect(result.metadata).toEqual(packed.metadata);
    expect(result.manifest).toMatchObject(
      JSON.parse(JSON.stringify(manifest)) as Record<string, unknown>,
    );
    expect(result.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a publish payload that does not match the artifact", async () => {
    const appDirectory = path.resolve(
      import.meta.dirname,
      "../../../nextclaw/resources/apps/nextclaw-personal-organizer",
    );
    const bundlePath = path.join(
      tmpdir(),
      `nextclaw-artifact-mismatch-${Date.now()}-${Math.random().toString(16).slice(2)}.napp`,
    );
    cleanupPaths.push(bundlePath);
    const manifest = (await new AppManifestService().load(appDirectory))
      .manifest;
    await new AppBundleService().packAppDirectory({
      appDirectory,
      outputPath: bundlePath,
    });

    await expect(
      new AppArtifactValidationService().validate({
        bytes: new Uint8Array(await readFile(bundlePath)),
        expected: {
          appId: manifest.id,
          name: manifest.name,
          version: "99.0.0",
          distributionMode: "bundle",
          manifest,
        },
      }),
    ).rejects.toThrow("publish payload 不一致");
  });

  it("rejects unsafe archive paths before extraction", async () => {
    const maliciousArchive = zipSync({
      "../outside.txt": strToU8("outside"),
    });

    await expect(
      new AppArtifactValidationService().validate({ bytes: maliciousArchive }),
    ).rejects.toThrow("非法路径");
  });
});
