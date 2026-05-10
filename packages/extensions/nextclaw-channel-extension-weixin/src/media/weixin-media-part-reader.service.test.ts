import { afterEach, describe, expect, it, vi } from "vitest";
import { WeixinMediaPartReader } from "./weixin-media-part-reader.service.js";

const originalEndpoint = process.env.NEXTCLAW_EXTENSION_ENDPOINT;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalEndpoint === undefined) {
    delete process.env.NEXTCLAW_EXTENSION_ENDPOINT;
  } else {
    process.env.NEXTCLAW_EXTENSION_ENDPOINT = originalEndpoint;
  }
});

describe("WeixinMediaPartReader", () => {
  it("falls back to the asset content url when assetUri cannot be resolved in the extension process", async () => {
    process.env.NEXTCLAW_EXTENSION_ENDPOINT = "http://127.0.0.1:18892";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(Buffer.from("png-bytes"), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const reader = new WeixinMediaPartReader();

    const media = await reader.read(
      {
        conversationId: "user-1@im.wechat",
      },
      {
        type: "file",
        name: "output.png",
        mimeType: "image/png",
        assetUri: "asset://store/2026/04/17/asset_1",
        url: "/api/ncp/assets/content?uri=asset_1",
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:18892/api/ncp/assets/content?uri=asset_1",
    );
    expect(media).toMatchObject({
      fileName: "output.png",
      mimeType: "image/png",
      isImage: true,
    });
  });
});
