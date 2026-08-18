/// <reference types="node" />

import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AppBundleService } from "@nextclaw/app-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceAppArtifactValidationService } from "../marketplace-app-artifact-validation.service";
import { MarketplaceAppPayloadParser } from "../marketplace-app-payload.service";
import { MarketplaceAppReleaseArtifactService } from "./marketplace-app-release-artifact.service";

describe("MarketplaceAppReleaseArtifactService", () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(cleanupPaths.map((entryPath) =>
      rm(entryPath, { recursive: true, force: true }),
    ));
    cleanupPaths.length = 0;
  });

  it("validates every target and checks version immutability before writing R2", async () => {
    const putBundle = vi.fn();
    const validate = vi.fn().mockResolvedValue(undefined);
    const service = new MarketplaceAppReleaseArtifactService(
      { decodeBase64: () => new Uint8Array([1, 2, 3]) } as never,
      { validate } as never,
      { putBundle } as never,
    );
    const input = {
      appId: "alice.native-todo",
      version: "1.0.0",
      artifacts: [
        {
          target: { kind: "native" as const, os: "darwin" as const, arch: "arm64" as const },
          bundleBase64: "YXBw",
          bundleSha256: "a".repeat(64),
          sizeBytes: 3,
        },
        {
          target: {
            kind: "native" as const,
            os: "linux" as const,
            arch: "x64" as const,
            abi: "gnu" as const,
          },
          bundleBase64: "YXBw",
          bundleSha256: "b".repeat(64),
          sizeBytes: 3,
        },
      ],
    };

    await expect(service.prepare(input as never, () => {
      throw new Error("immutable version");
    })).rejects.toThrow("immutable version");

    expect(validate).toHaveBeenCalledTimes(2);
    expect(putBundle).not.toHaveBeenCalled();
  });

  it("validates a targeted artifact when optional manifest permissions are omitted", async () => {
    const workspaceDirectory = await mkdtemp(path.join(tmpdir(), "marketplace-targeted-artifact-"));
    cleanupPaths.push(workspaceDirectory);
    const appDirectory = path.join(workspaceDirectory, "app");
    const bundlePath = path.join(workspaceDirectory, "linux-x64-gnu.napp");
    await cp(
      path.resolve(
        import.meta.dirname,
        "../../../../../../packages/nextclaw/resources/apps/nextclaw-personal-organizer",
      ),
      appDirectory,
      { recursive: true },
    );
    const manifestPath = path.join(appDirectory, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as Record<string, unknown>;
    const target = { kind: "native" as const, os: "linux" as const, arch: "x64" as const, abi: "gnu" as const };
    manifest.distribution = { mode: "targeted", targets: [target] };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
    await new AppBundleService().packAppDirectory({ appDirectory, outputPath: bundlePath, target });
    const bytes = new Uint8Array(await readFile(bundlePath));
    const bundleSha256 = createHash("sha256").update(bytes).digest("hex");
    const parser = new MarketplaceAppPayloadParser();
    const input = parser.parsePublishInput({
      slug: "personal-organizer",
      appId: manifest.id,
      name: manifest.name,
      version: manifest.version,
      summary: "Personal organizer",
      summaryI18n: { en: "Personal organizer" },
      author: "NextClaw",
      tags: ["personal"],
      featured: false,
      publisher: { id: "nextclaw", name: "NextClaw" },
      manifest,
      permissions: { storage: true, capabilities: { nativeProcess: true } },
      distributionMode: "bundle",
      files: [{ path: "marketplace.json", contentBase64: "e30=" }],
      artifacts: [{
        target,
        bundleBase64: Buffer.from(bytes).toString("base64"),
        bundleSha256,
        sizeBytes: bytes.byteLength,
      }],
    });

    expect(input.manifest.permissions).toBeUndefined();
    await expect(new MarketplaceAppArtifactValidationService().validate(
      bytes,
      input,
      input.artifacts![0],
    )).resolves.toBeUndefined();
  });
});
