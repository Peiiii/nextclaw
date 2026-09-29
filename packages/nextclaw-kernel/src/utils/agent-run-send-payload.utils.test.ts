import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import { buildAgentRunSendPayload } from "./agent-run-send-payload.utils.js";

describe("platform-owned attachment ingestion", () => {
  it("preserves local attachment bytes and metadata through the existing Node asset store", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-attachment-"));
    try {
      const path = join(directory, "source.txt");
      await writeFile(path, "retained attachment");
      const assets = new LocalAssetStore({ rootDir: join(directory, "assets") });
      const payload = await buildAgentRunSendPayload({ sessionId: "session", content: "read this",
        attachments: [{ path, name: "source.txt", mimeType: "text/plain", size: 19 }], assetApi: assets });
      const part = payload.content[1];
      expect(part).toMatchObject({ type: "file", name: "source.txt", mimeType: "text/plain", sizeBytes: 19 });
      if (typeof part !== "object" || part.type !== "file" || !part.assetUri) throw new Error("Missing asset reference");
      expect((await assets.readAssetBytes(part.assetUri))?.toString()).toBe("retained attachment");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("builds remote and existing asset references without a local filesystem resource", async () => {
    const payload = await buildAgentRunSendPayload({ sessionId: "session", content: "",
      attachments: [{ url: "https://example.com/files/readme.txt" }, { assetUri: "asset://owned/reference" }] });
    expect(payload.content).toEqual([
      { type: "file", url: "https://example.com/files/readme.txt", name: "readme.txt" },
      { type: "file", assetUri: "asset://owned/reference" },
    ]);
    await expect(buildAgentRunSendPayload({ sessionId: "session", content: "",
      attachments: [{ path: "/unavailable/file" }] })).rejects.toThrow("asset api is unavailable");
  });
});
