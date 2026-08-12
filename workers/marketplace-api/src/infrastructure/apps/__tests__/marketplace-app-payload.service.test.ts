import { describe, expect, it } from "vitest";
import { MarketplaceAppPayloadParser } from "../marketplace-app-payload.service";

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

function buildInput(visuals: { cover: string; accentColor: string }) {
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
