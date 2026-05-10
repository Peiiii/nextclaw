import { afterEach, describe, expect, it, vi } from "vitest";
import { sendWeixinFileMessage, sendWeixinImageMessage } from "./weixin-media.utils.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("weixin media sending", () => {
  it("uploads and sends native image messages", async () => {
    const fetchMock = createMediaFetchMock("upload-param-image", "download-param-image");
    globalThis.fetch = fetchMock as typeof fetch;

    await sendWeixinImageMessage({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
      toUserId: "user-1@im.wechat",
      bytes: new Uint8Array([1, 2, 3, 4]),
      contextToken: "ctx-1",
    });

    const sendBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(sendBody).toMatchObject({
      msg: {
        to_user_id: "user-1@im.wechat",
        context_token: "ctx-1",
        item_list: [{
          type: 2,
          image_item: {
            media: {
              encrypt_query_param: "download-param-image",
              encrypt_type: 1,
            },
          },
        }],
      },
    });
  });

  it("uploads and sends native file messages", async () => {
    const fetchMock = createMediaFetchMock("upload-param-file", "download-param-file");
    globalThis.fetch = fetchMock as typeof fetch;

    await sendWeixinFileMessage({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
      toUserId: "user-1@im.wechat",
      fileName: "report.pdf",
      bytes: new Uint8Array([1, 2, 3, 4]),
      contextToken: "ctx-1",
    });

    const sendBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(sendBody).toMatchObject({
      msg: {
        to_user_id: "user-1@im.wechat",
        context_token: "ctx-1",
        item_list: [{
          type: 4,
          file_item: {
            file_name: "report.pdf",
            media: {
              encrypt_query_param: "download-param-file",
              encrypt_type: 1,
            },
          },
        }],
      },
    });
  });
});

function createMediaFetchMock(uploadParam: string, downloadParam: string) {
  return vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ upload_param: uploadParam }), { status: 200 }))
    .mockResolvedValueOnce(new Response(null, {
      status: 200,
      headers: {
        "x-encrypted-param": downloadParam,
      },
    }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ret: 0, errcode: 0 }), { status: 200 }));
}
