import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppBundleService } from "./app-bundle.service.js";
import { AppPublishService } from "./app-publish.service.js";
import type { PlatformAuthStateService } from "./platform-auth-state.service.js";

describe("AppPublishService targeted artifacts", () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(cleanupPaths.map((entryPath) =>
      rm(entryPath, { recursive: true, force: true }),
    ));
    cleanupPaths.length = 0;
  });

  it("publishes one logical version with the exact declared target artifacts", async () => {
    const workspaceDirectory = await mkdtemp(path.join(tmpdir(), "napp-publish-targeted-"));
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
    const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as Record<string, unknown>;
    manifest.distribution = {
      mode: "targeted",
      targets: [{ kind: "native", os: "darwin", arch: "arm64" }],
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
    await new AppBundleService().packAppDirectory({
      appDirectory,
      outputPath: path.join(artifactsDirectory, "darwin-arm64.napp"),
      target: { kind: "native", os: "darwin", arch: "arm64" },
    });
    const publish = vi.fn().mockResolvedValue({
      created: true,
      item: {
        slug: "personal-organizer",
        appId: "nextclaw.personal-organizer",
        ownerScope: "nextclaw",
        appName: "personal-organizer",
        publishStatus: "published",
        name: "个人空间",
        latestVersion: "0.1.4",
        install: {
          kind: "registry",
          spec: "nextclaw.personal-organizer",
          registry: "https://apps-registry.nextclaw.io/api/v1/apps/registry/",
        },
      },
      fileCount: 2,
    });
    const service = new AppPublishService(
      undefined,
      undefined,
      undefined,
      { publish } as never,
      {
        readCurrentAuthState: () => ({
          token: "admin-token",
          apiBaseUrl: "https://ai-gateway-api.nextclaw.io/v1",
        }),
      } as PlatformAuthStateService,
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { user: { id: "admin-1", username: "admin", role: "admin" } },
      }),
    }));

    const result = await service.publish({ appDirectory, artifactsDirectory });

    expect(publish.mock.calls[0]?.[0]?.payload).toMatchObject({
      artifacts: [{
        target: { kind: "native", os: "darwin", arch: "arm64" },
        sizeBytes: expect.any(Number),
      }],
    });
    expect(publish.mock.calls[0]?.[0]?.payload).not.toHaveProperty("bundleBase64");
    expect(result.distribution.artifacts?.[0]?.target).toEqual({
      kind: "native",
      os: "darwin",
      arch: "arm64",
    });
  });
});
