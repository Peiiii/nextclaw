import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import {
  NativeManagedAssetSupport,
} from "./native-managed-asset-support.js";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function extractTextParts(content: unknown): string[] {
  if (typeof content === "string") {
    return [content];
  }
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("native managed asset support", () => {
  it("turns local inbound attachments into managed assets", async () => {
    const rootDir = createTempDir("nextclaw-native-assets-");
    const inputDir = createTempDir("nextclaw-native-input-");
    const inputPath = join(inputDir, "notes.md");
    writeFileSync(inputPath, "# hello\n");
    const assetStore = new LocalAssetStore({ rootDir });
    const support = new NativeManagedAssetSupport(assetStore);

    const attachments = await support.prepareAttachments([
      {
        path: inputPath,
        name: "notes.md",
        mimeType: "text/markdown",
        source: "weixin",
        status: "ready",
      },
    ]);

    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.assetUri).toMatch(/^asset:\/\/store\//);
    expect(attachments[0]?.path).toBe(inputPath);
    expect(attachments[0]?.mimeType).toBe("text/markdown");
  });

  it("builds asset reference prompt content for non-image attachments", async () => {
    const rootDir = createTempDir("nextclaw-native-assets-");
    const assetStore = new LocalAssetStore({ rootDir });
    const support = new NativeManagedAssetSupport(assetStore);
    const record = await assetStore.putBytes({
      fileName: "notes.md",
      mimeType: "text/markdown",
      bytes: Buffer.from("# title\nbody\n"),
    });

    const content = support.buildContent({
      text: "[收到文件: notes.md]",
      attachments: [
        {
          name: "notes.md",
          mimeType: "text/markdown",
          assetUri: record.uri,
          size: record.sizeBytes,
          source: "weixin",
          status: "ready",
        },
      ],
    });

    const renderedText = extractTextParts(content).join("\n");
    expect(renderedText).toContain("[收到文件: notes.md]");
    expect(renderedText).toContain("[Asset: notes.md]");
    expect(renderedText).toContain(`[Asset URI: ${record.uri}]`);
    expect(renderedText).toContain("asset_export");
  });

  it("exposes asset tools that can export managed assets", async () => {
    const rootDir = createTempDir("nextclaw-native-assets-");
    const exportDir = createTempDir("nextclaw-native-export-");
    const assetStore = new LocalAssetStore({ rootDir });
    const support = new NativeManagedAssetSupport(assetStore);
    const record = await assetStore.putBytes({
      fileName: "notes.md",
      mimeType: "text/markdown",
      bytes: Buffer.from("# exported\n"),
    });

    const assetExportTool = support.additionalTools.find((tool) => tool.name === "asset_export");
    expect(assetExportTool).toBeDefined();

    const targetPath = join(exportDir, "notes.md");
    const result = await assetExportTool?.execute({
      assetUri: record.uri,
      targetPath,
    });

    expect(result).toEqual({
      ok: true,
      assetUri: record.uri,
      exportedPath: targetPath,
    });
    expect(readFileSync(targetPath, "utf-8")).toBe("# exported\n");
  });
});
