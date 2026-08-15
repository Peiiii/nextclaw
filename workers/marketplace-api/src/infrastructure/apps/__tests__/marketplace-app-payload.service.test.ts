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

  it("rejects a schema v2 WASI label until Service components have a WASI execution contract", () => {
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
      components: [{ kind: "service", path: "services/notes" }],
    };

    expect(() => new MarketplaceAppPayloadParser().parsePublishInput(input))
      .toThrow("schema v2 Service components do not support a WASI runtime yet");
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
