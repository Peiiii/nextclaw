import { describe, expect, it } from "vitest";
import { MarketplaceAppPayloadParser } from "@/infrastructure/apps/marketplace-app-payload.service";

describe("MarketplaceAppPayloadParser visuals", () => {
  it("accepts a safe cover path and normalizes the accent color", () => {
    const parsed = new MarketplaceAppPayloadParser().parsePublishInput(buildInput({
      cover: "marketplace-assets/cover.webp",
      accentColor: "#74816b",
    }));

    expect(parsed.visuals).toEqual({
      cover: "marketplace-assets/cover.webp",
      accentColor: "#74816B",
    });
  });

  it("rejects an unsafe cover path", () => {
    expect(() => new MarketplaceAppPayloadParser().parsePublishInput(buildInput({
      cover: "../cover.webp",
      accentColor: "#74816B",
    }))).toThrow("visuals.cover must be a safe relative path");
  });
});

describe("MarketplaceAppPayloadParser runtime risk", () => {
  it("derives full-user native process permissions for legacy schema v2 services", () => {
    const input = buildInput({
      cover: "marketplace-assets/cover.webp",
      accentColor: "#74816B",
    });
    input.manifest = {
      schemaVersion: 2,
      id: "nextclaw.hello-notes",
      name: "Hello Notes",
      version: "0.1.0",
      components: [{ kind: "service", path: "services/notes" }],
    };

    const parsed = new MarketplaceAppPayloadParser().parsePublishInput(input);

    expect(parsed.permissions).toMatchObject({
      storage: true,
      capabilities: { nativeProcess: true },
    });
  });

  it("rejects a panel-only declaration that contains a service", () => {
    const input = buildInput({
      cover: "marketplace-assets/cover.webp",
      accentColor: "#74816B",
    });
    input.manifest = {
      schemaVersion: 2,
      id: "nextclaw.hello-notes",
      name: "Hello Notes",
      version: "0.1.0",
      runtime: { profile: "panel-only" },
      components: [{ kind: "service", path: "services/notes" }],
    };

    expect(() => new MarketplaceAppPayloadParser().parsePublishInput(input))
      .toThrow("panel-only apps cannot contain service components");
  });

  it("accepts a universal schema v2 WASI Service without native process permissions", () => {
    const input = buildInput({
      cover: "marketplace-assets/cover.webp",
      accentColor: "#74816B",
    });
    input.manifest = {
      schemaVersion: 2,
      id: "nextclaw.hello-notes",
      name: "Hello Notes",
      version: "0.1.0",
      runtime: { profile: "wasi" },
      distribution: { mode: "universal" },
      components: [{ kind: "service", path: "services/notes" }],
    };

    const parsed = new MarketplaceAppPayloadParser().parsePublishInput(input);

    expect(parsed.manifest).toMatchObject({ runtime: { profile: "wasi" } });
    expect(parsed.permissions.capabilities?.nativeProcess).toBeUndefined();
  });

  it("rejects a targeted schema v2 WASI Service", () => {
    const input = buildInput({
      cover: "marketplace-assets/cover.webp",
      accentColor: "#74816B",
    });
    input.manifest = {
      schemaVersion: 2,
      id: "nextclaw.hello-notes",
      name: "Hello Notes",
      version: "0.1.0",
      runtime: { profile: "wasi" },
      distribution: {
        mode: "targeted",
        targets: [{ kind: "native", os: "darwin", arch: "arm64" }],
      },
      components: [{ kind: "service", path: "services/notes" }],
    };
    delete input.bundleBase64;
    delete input.bundleSha256;
    input.artifacts = [{
      target: { kind: "native", os: "darwin", arch: "arm64" },
      bundleBase64: "YXBw",
      bundleSha256: "darwin-sha",
      sizeBytes: 3,
    }];

    expect(() => new MarketplaceAppPayloadParser().parsePublishInput(input))
      .toThrow("runtime.profile=wasi requires distribution.mode=universal");
  });
});

describe("MarketplaceAppPayloadParser platform artifacts", () => {
  it("accepts one or multiple artifacts when they exactly match declared targets", () => {
    const input = buildInput({
      cover: "marketplace-assets/cover.webp",
      accentColor: "#74816B",
    });
    input.manifest = {
      schemaVersion: 2,
      id: "nextclaw.hello-notes",
      name: "Hello Notes",
      version: "0.1.0",
      runtime: { profile: "native-process" },
      distribution: {
        mode: "targeted",
        targets: [
          { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
          { kind: "native", os: "darwin", arch: "arm64" },
        ],
      },
      components: [{ kind: "service", path: "services/notes" }],
    };
    delete input.bundleBase64;
    delete input.bundleSha256;
    input.artifacts = [
      {
        target: { kind: "native", os: "darwin", arch: "arm64" },
        bundleBase64: "YXBw",
        bundleSha256: "darwin-sha",
        sizeBytes: 3,
      },
      {
        target: { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
        bundleBase64: "YXBw",
        bundleSha256: "linux-sha",
        sizeBytes: 3,
      },
    ];

    const parsed = new MarketplaceAppPayloadParser().parsePublishInput(input);

    expect(parsed.artifacts).toHaveLength(2);
    expect(parsed.manifest.permissions).toBeUndefined();
    expect(JSON.parse(JSON.stringify(parsed.manifest))).not.toHaveProperty("permissions");
    expect(parsed.permissions).toMatchObject({
      storage: true,
      capabilities: { nativeProcess: true },
    });
  });

  it("rejects a targeted release when a declared platform artifact is missing", () => {
    const input = buildInput({
      cover: "marketplace-assets/cover.webp",
      accentColor: "#74816B",
    });
    input.manifest = {
      schemaVersion: 2,
      id: "nextclaw.hello-notes",
      name: "Hello Notes",
      version: "0.1.0",
      distribution: {
        mode: "targeted",
        targets: [
          { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
          { kind: "native", os: "darwin", arch: "arm64" },
        ],
      },
      components: [{ kind: "service", path: "services/notes" }],
    };
    delete input.bundleBase64;
    delete input.bundleSha256;
    input.artifacts = [{
      target: { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
      bundleBase64: "YXBw",
      bundleSha256: "linux-sha",
      sizeBytes: 3,
    }];

    expect(() => new MarketplaceAppPayloadParser().parsePublishInput(input))
      .toThrow("声明 targets 与submitted artifacts 不一致");
  });
});

function buildInput(visuals: { cover: string; accentColor: string }): Record<string, unknown> {
  return {
    slug: "hello-notes",
    appId: "nextclaw.hello-notes",
    name: "Hello Notes",
    version: "0.1.0",
    summary: "Notes",
    summaryI18n: { en: "Notes" },
    author: "NextClaw",
    tags: ["notes"],
    featured: true,
    publisher: { id: "nextclaw", name: "NextClaw" },
    visuals,
    manifest: {
      schemaVersion: 1,
      id: "nextclaw.hello-notes",
      name: "Hello Notes",
      version: "0.1.0",
      main: { kind: "wasi-http-component", entry: "main/app.wasm" },
      ui: { entry: "ui/index.html" },
    },
    permissions: {},
    distributionMode: "bundle",
    bundleBase64: "YXBw",
    bundleSha256: "sha",
    files: [{ path: "marketplace.json", contentBase64: "e30=" }],
  };
}
