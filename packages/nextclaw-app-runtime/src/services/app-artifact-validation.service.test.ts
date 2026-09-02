import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, unzipSync, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { AppBundleService } from "./app-bundle.service.js";
import { AppManifestService } from "./app-manifest.service.js";
import { AppArtifactValidationService } from "./app-artifact-validation.service.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupPaths.map((entryPath) => rm(entryPath, { recursive: true, force: true })),
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

  it("rejects a WASI artifact whose Service uses the host-process protocol", async () => {
    const workspaceDirectory = await mkdtemp(path.join(tmpdir(), "nextclaw-wasi-protocol-"));
    cleanupPaths.push(workspaceDirectory);
    const appDirectory = path.join(workspaceDirectory, "app");
    const bundlePath = path.join(workspaceDirectory, "invalid-protocol.napp");
    await cp(
      path.resolve(
        import.meta.dirname,
        "../../../nextclaw/resources/apps/nextclaw-github-issue-watcher",
      ),
      appDirectory,
      { recursive: true },
    );
    await new AppBundleService().packAppDirectory({ appDirectory, outputPath: bundlePath });
    await rewriteArchiveJsonEntry(
      bundlePath,
      "service-components/nextclaw-github-issue-watcher-service/service-app.json",
      (serviceManifest) => ({ ...serviceManifest, protocol: "mcp", component: undefined }),
    );

    await expect(new AppArtifactValidationService().validate({
      bytes: new Uint8Array(await readFile(bundlePath)),
    })).rejects.toThrow("runtime.profile=wasi 的所有 Service component 必须使用 wasi-component protocol");
  });

  it("rejects a core WebAssembly module where a WASI Component is declared", async () => {
    const workspaceDirectory = await mkdtemp(path.join(tmpdir(), "nextclaw-wasi-binary-"));
    cleanupPaths.push(workspaceDirectory);
    const appDirectory = path.join(workspaceDirectory, "app");
    const bundlePath = path.join(workspaceDirectory, "core-module.napp");
    await cp(
      path.resolve(
        import.meta.dirname,
        "../../../nextclaw/resources/apps/nextclaw-github-issue-watcher",
      ),
      appDirectory,
      { recursive: true },
    );
    await writeFile(
      path.join(
        appDirectory,
        "service-components/nextclaw-github-issue-watcher-service/service.wasm",
      ),
      new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
    );
    await new AppBundleService().packAppDirectory({ appDirectory, outputPath: bundlePath });

    await expect(new AppArtifactValidationService().validate({
      bytes: new Uint8Array(await readFile(bundlePath)),
    })).rejects.toThrow("不是 WebAssembly Component binary");
  });
});

async function rewriteArchiveJsonEntry(
  bundlePath: string,
  entryPath: string,
  update: (value: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const archive = unzipSync(new Uint8Array(await readFile(bundlePath)));
  const nextEntry = strToU8(`${JSON.stringify(update(
    JSON.parse(Buffer.from(archive[entryPath] as Uint8Array).toString("utf8")),
  ), null, 2)}\n`);
  archive[entryPath] = nextEntry;
  const checksumsPath = ".napp/checksums.json";
  const checksums = JSON.parse(
    Buffer.from(archive[checksumsPath] as Uint8Array).toString("utf8"),
  ) as { algorithm: "sha256"; files: Record<string, string> };
  checksums.files[entryPath] = createHash("sha256").update(nextEntry).digest("hex");
  archive[checksumsPath] = strToU8(`${JSON.stringify(checksums, null, 2)}\n`);
  await writeFile(bundlePath, zipSync(archive, { level: 9 }));
}
