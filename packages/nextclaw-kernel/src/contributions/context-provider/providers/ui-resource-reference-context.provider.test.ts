import { describe, expect, it } from "vitest";
import {
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_INLINE_TOKENS_SCHEMA_VERSION,
  CHAT_UI_RESOURCE_TOKEN_KIND,
} from "@nextclaw/shared";
import { UiResourceReferenceContextProvider } from "./ui-resource-reference-context.provider.js";

function createRequest(reference: Record<string, unknown>) {
  return {
    message: {
      id: "message-1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Review @resource:nextclaw%3A%2F%2Fapps" }],
      metadata: {
        [CHAT_INLINE_TOKENS_METADATA_KEY]: {
          schemaVersion: CHAT_INLINE_TOKENS_SCHEMA_VERSION,
          items: [{
            kind: CHAT_UI_RESOURCE_TOKEN_KIND,
            key: "nextclaw://apps",
            label: "Apps",
            rawText: "@resource:nextclaw%3A%2F%2Fapps",
            reference,
          }],
        },
      },
    },
  };
}

describe("UiResourceReferenceContextProvider", () => {
  it("injects a visible resource identity and bounded initial params", () => {
    const provider = new UiResourceReferenceContextProvider();
    const blocks = provider.provide(createRequest({
      uri: "nextclaw://apps",
      resourceKind: "apps",
      title: "Apps",
      currentUrl: "nextclaw://apps?tab=panel-apps",
      contentParams: { filter: "installed" },
    }));

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain("## Explicit UI Resource References");
    expect(blocks[0]).toContain('"uri": "nextclaw://apps"');
    expect(blocks[0]).toContain('"filter": "installed"');
    expect(blocks[0]).toContain("not a snapshot of iframe DOM");
  });

  it("rejects a reference whose token key does not match its URI", () => {
    const provider = new UiResourceReferenceContextProvider();
    const request = createRequest({
      uri: "nextclaw://docs/guide",
      resourceKind: "docs",
      title: "Guide",
      currentUrl: "/guide",
    });

    expect(provider.provide(request)).toEqual([]);
  });

  it("omits oversized params as a whole instead of emitting partial JSON", () => {
    const provider = new UiResourceReferenceContextProvider();
    const blocks = provider.provide(createRequest({
      uri: "nextclaw://apps",
      resourceKind: "apps",
      title: "Apps",
      currentUrl: "nextclaw://apps",
      contentParams: { payload: "x".repeat(9 * 1024) },
    }));

    expect(blocks[0]).toContain("contentParamsOmitted");
    expect(blocks[0]).not.toContain("x".repeat(9 * 1024));
  });
});
