import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { LocalAssetStore } from "./asset-store.js";
import { DefaultNcpContextBuilder } from "./context-builder.js";

const tempDirs: string[] = [];

function createAssetStore(): LocalAssetStore {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-context-builder-test-"));
  tempDirs.push(rootDir);
  return new LocalAssetStore({ rootDir });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("DefaultNcpContextBuilder", () => {
  it("converts image file parts into multimodal image inputs with asset hints", () => {
    const builder = new DefaultNcpContextBuilder();
    const prepared = builder.prepare({
      sessionId: "session-1",
      messages: [
        {
          id: "user-1",
          sessionId: "session-1",
          role: "user",
          status: "final",
          timestamp: "2026-03-25T12:00:00.000Z",
          parts: [
            { type: "text", text: "describe this" },
            {
              type: "file",
              mimeType: "image/png",
              contentBase64: "ZmFrZS1pbWFnZQ==",
              sizeBytes: 12,
            },
          ],
        },
      ],
    });

    expect(prepared.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "describe this" },
          {
            type: "image_url",
            image_url: {
              url: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
              detail: "auto",
            },
          },
          {
            type: "text",
            text: [
              "[Attached Image: asset]",
              "[MIME: image/png]",
              "[Size Bytes: 12]",
              "[Instruction: This image is embedded in the prompt.]",
            ].join("\n"),
          },
        ],
      },
    ]);
  });

  it("converts uploaded image assets into multimodal image inputs with asset hints", async () => {
    const assetStore = createAssetStore();
    const record = await assetStore.putBytes({
      fileName: "screen.png",
      mimeType: "image/png",
      bytes: Buffer.from("ZmFrZS1pbWFnZQ==", "base64"),
    });
    const builder = new DefaultNcpContextBuilder({
      assetStore,
    });

    const prepared = builder.prepare({
      sessionId: "session-1",
      messages: [
        {
          id: "user-image-asset-1",
          sessionId: "session-1",
          role: "user",
          status: "final",
          timestamp: "2026-03-25T12:00:00.000Z",
          parts: [
            { type: "text", text: "inspect this screenshot" },
            {
              type: "file",
              name: "screen.png",
              mimeType: "image/png",
              assetUri: record.uri,
              sizeBytes: record.sizeBytes,
            },
          ],
        },
      ],
    });

    expect(prepared.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "inspect this screenshot" },
          {
            type: "image_url",
            image_url: {
              url: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
              detail: "auto",
            },
          },
          {
            type: "text",
            text: [
              "[Attached Image: screen.png]",
              "[MIME: image/png]",
              `[Asset URI: ${record.uri}]`,
              `[Size Bytes: ${record.sizeBytes}]`,
              "[Instruction: This image is embedded in the prompt. If you need to transform or process the original file with tools, use the asset URI.]",
            ].join("\n"),
          },
        ],
      },
    ]);
  });

  it("references uploaded assets instead of injecting file contents", async () => {
    const assetStore = createAssetStore();
    const record = await assetStore.putBytes({
      fileName: "config.json",
      mimeType: "application/json",
      bytes: Buffer.from('{"feature":"enabled"}', "utf8"),
    });
    const builder = new DefaultNcpContextBuilder({
      assetStore,
    });

    const prepared = builder.prepare({
      sessionId: "session-1",
      messages: [
        {
          id: "user-2",
          sessionId: "session-1",
          role: "user",
          status: "final",
          timestamp: "2026-03-25T12:00:00.000Z",
          parts: [
            { type: "text", text: "read this file" },
            {
              type: "file",
              name: "config.json",
              mimeType: "application/json",
              assetUri: record.uri,
              sizeBytes: record.sizeBytes,
            },
          ],
        },
      ],
    });

    expect(prepared.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "read this file" },
          {
            type: "text",
            text: [
              "[Asset: config.json]",
              "[MIME: application/json]",
              `[Asset URI: ${record.uri}]`,
              `[Size Bytes: ${record.sizeBytes}]`,
              "[Instruction: This file is not embedded in the prompt. If you need to inspect or transform it, use asset_export to copy it to a normal file path first.]",
            ].join("\n"),
          },
        ],
      },
    ]);
  });
});
