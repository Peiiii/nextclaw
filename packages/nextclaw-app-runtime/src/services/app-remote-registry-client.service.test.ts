import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPlatformTargetService } from "./app-platform-target.service.js";
import { AppRemoteRegistryClientService } from "./app-remote-registry-client.service.js";
import type { AppRegistryConfigService } from "./app-registry-config.service.js";

const REGISTRY_URL = "https://registry.example.test/api/v1/apps/registry/";

describe("AppRemoteRegistryClientService targeted artifacts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects the latest version compatible with the current host target", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      name: "peiiii.native-todo",
      "dist-tags": { latest: "2.0.0" },
      versions: {
        "2.0.0": {
          name: "peiiii.native-todo",
          version: "2.0.0",
          dist: {
            kind: "targeted-bundle",
            artifacts: [{
              target: { kind: "native", os: "darwin", arch: "arm64" },
              bundle: "/bundles/2.0.0/darwin-arm64",
              sha256: "2".repeat(64),
            }],
          },
        },
        "1.5.0": {
          name: "peiiii.native-todo",
          version: "1.5.0",
          dist: {
            kind: "targeted-bundle",
            artifacts: [{
              target: { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
              bundle: "/bundles/1.5.0/linux-x64-gnu",
              sha256: "1".repeat(64),
              sizeBytes: 1024,
            }],
          },
        },
      },
    }), { status: 200 })));
    const client = new AppRemoteRegistryClientService(
      createConfigService(),
      new AppPlatformTargetService({ platform: "linux", arch: "x64", linuxAbi: "gnu" }),
    );

    await expect(client.resolve({ appId: "peiiii.native-todo" })).resolves.toMatchObject({
      version: "1.5.0",
      bundleUrl: "https://registry.example.test/bundles/1.5.0/linux-x64-gnu",
      sha256: "1".repeat(64),
      target: { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
    });
  });

  it("rejects an explicitly requested version before downloading when no target matches", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      name: "peiiii.native-todo",
      "dist-tags": { latest: "2.0.0" },
      versions: {
        "2.0.0": {
          name: "peiiii.native-todo",
          version: "2.0.0",
          dist: {
            kind: "targeted-bundle",
            artifacts: [{
              target: { kind: "native", os: "darwin", arch: "arm64" },
              bundle: "/bundles/2.0.0/darwin-arm64",
              sha256: "2".repeat(64),
            }],
          },
        },
      },
    }), { status: 200 })));
    const client = new AppRemoteRegistryClientService(
      createConfigService(),
      new AppPlatformTargetService({ platform: "linux", arch: "x64", linuxAbi: "gnu" }),
    );

    await expect(client.resolve({
      appId: "peiiii.native-todo",
      version: "2.0.0",
    })).rejects.toThrow("不支持当前 target linux-x64-gnu");
  });
});

function createConfigService(): AppRegistryConfigService {
  return {
    getSnapshot: async () => ({
      defaultUrl: REGISTRY_URL,
      currentUrl: REGISTRY_URL,
      source: "default" as const,
    }),
  } as AppRegistryConfigService;
}
