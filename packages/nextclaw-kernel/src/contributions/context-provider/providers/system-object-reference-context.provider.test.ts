import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_INLINE_TOKENS_SCHEMA_VERSION,
  CHAT_SYSTEM_OBJECT_TOKEN_KIND,
  createSystemObjectReferenceUri,
  SYSTEM_OBJECT_TYPE_CRON_JOB,
} from "@nextclaw/shared";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import { SystemObjectReferenceContextProvider } from "./system-object-reference-context.provider.js";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

describe("SystemObjectReferenceContextProvider", () => {
  it("loads only the immutable asset explicitly referenced by the visible token", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-system-object-context-"));
    tempDirs.push(directory);
    const assetStore = new LocalAssetStore({ rootDir: directory });
    const asset = await assetStore.putBytes({
      bytes: new TextEncoder().encode("# Daily review\n\nReview unread reports"),
      fileName: "daily-review.md",
      mimeType: "text/markdown",
    });
    const uri = createSystemObjectReferenceUri(SYSTEM_OBJECT_TYPE_CRON_JOB, "cron-1");
    const provider = new SystemObjectReferenceContextProvider(assetStore);

    const blocks = await provider.provide({
      message: {
        id: "message-1",
        role: "user",
        parts: [{ type: "text", text: `@object:${encodeURIComponent(uri)} explain it` }],
        metadata: {
          [CHAT_INLINE_TOKENS_METADATA_KEY]: {
            schemaVersion: CHAT_INLINE_TOKENS_SCHEMA_VERSION,
            items: [{
              kind: CHAT_SYSTEM_OBJECT_TOKEN_KIND,
              key: uri,
              label: "Daily review",
              rawText: `@object:${encodeURIComponent(uri)}`,
              reference: {
                uri,
                objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
                objectId: "cron-1",
                label: "Daily review",
                description: null,
                updatedAt: asset.createdAt,
                version: asset.sha256,
                assetUri: asset.uri,
                fileName: asset.fileName,
                mimeType: asset.mimeType,
                sizeBytes: asset.sizeBytes,
              },
            }],
          },
        },
      },
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain("Explicit System Object References");
    expect(blocks[0]).toContain("Review unread reports");
  });

  it("does not resolve a bare text token without snapshot metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-system-object-context-"));
    tempDirs.push(directory);
    const provider = new SystemObjectReferenceContextProvider(
      new LocalAssetStore({ rootDir: directory }),
    );

    await expect(provider.provide({
      message: {
        id: "message-1",
        role: "user",
        parts: [{ type: "text", text: "@object:nextclaw-reference" }],
      },
    })).resolves.toEqual([]);
  });
});
