import { randomInt, randomUUID } from "node:crypto";

export type WeixinMessageItem = {
  type?: number;
  text_item?: { text?: string };
  image_item?: {
    media?: WeixinCdnMedia;
    thumb_media?: WeixinCdnMedia;
    aeskey?: string;
    mid_size?: number;
    thumb_size?: number;
    thumb_height?: number;
    thumb_width?: number;
    hd_size?: number;
  };
  voice_item?: { text?: string };
  file_item?: {
    file_name?: string;
    media?: WeixinCdnMedia;
    len?: string;
  };
};

export type WeixinCdnMedia = {
  encrypt_query_param?: string;
  aes_key?: string;
  encrypt_type?: number;
  full_url?: string;
};

export type WeixinMessage = {
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  message_type?: number;
  item_list?: WeixinMessageItem[];
  context_token?: string;
};

export type WeixinGetUpdatesResponse = {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinMessage[];
  get_updates_buf?: string;
};

export type WeixinConfigResponse = {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  typing_ticket?: string;
};

export type WeixinSendTypingResponse = {
  ret?: number;
  errcode?: number;
  errmsg?: string;
};

type WeixinBizResponse = {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  message_id?: string | number;
};

export type WeixinApiClient = {
  fetchUpdates: (params: {
    baseUrl: string;
    token: string;
    cursor?: string;
    timeoutMs: number;
    signal?: AbortSignal;
  }) => Promise<WeixinGetUpdatesResponse>;
  fetchConfig: (params: {
    baseUrl: string;
    token: string;
    ilinkUserId: string;
    contextToken: string;
    signal?: AbortSignal;
  }) => Promise<WeixinConfigResponse>;
  sendTyping: (params: {
    baseUrl: string;
    token: string;
    toUserId: string;
    typingTicket: string;
    status: 1 | 2;
    signal?: AbortSignal;
  }) => Promise<WeixinSendTypingResponse>;
  sendTextMessage: (params: {
    baseUrl: string;
    token: string;
    toUserId: string;
    text: string;
    contextToken?: string;
    signal?: AbortSignal;
  }) => Promise<{ messageId: string }>;
  sendMessageItem: (params: {
    baseUrl: string;
    token: string;
    toUserId: string;
    item: WeixinMessageItem;
    contextToken?: string;
    signal?: AbortSignal;
  }) => Promise<{ messageId: string }>;
};

export const WEIXIN_API_TIMEOUT_MS = 15_000;
export const WEIXIN_MESSAGE_TYPE_BOT = 2;
export const WEIXIN_MESSAGE_ITEM_TYPE_TEXT = 1;
export const WEIXIN_MESSAGE_ITEM_TYPE_IMAGE = 2;
export const WEIXIN_MESSAGE_ITEM_TYPE_FILE = 4;
export const WEIXIN_UPLOAD_MEDIA_TYPE_IMAGE = 1;
export const WEIXIN_UPLOAD_MEDIA_TYPE_FILE = 3;
export const WEIXIN_MEDIA_ENCRYPT_TYPE_PACKED = 1;
const WEIXIN_MESSAGE_STATE_FINISH = 2;
const WEIXIN_CHANNEL_VERSION = "nextclaw-weixin/0.1.0";

export function normalizeWeixinBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function buildUinHeader(): string {
  return Buffer.from(String(randomInt(0xffffffff)), "utf8").toString("base64");
}

export function buildWeixinBaseInfo(): { channel_version: string } {
  return {
    channel_version: WEIXIN_CHANNEL_VERSION,
  };
}

function stripSimpleMarkdown(text: string): string {
  return text
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_~`>#-]+/g, "")
    .trim();
}

function assertSuccess(response: WeixinBizResponse, action: string): void {
  const failedRet = typeof response.ret === "number" && response.ret !== 0;
  const failedErrcode = typeof response.errcode === "number" && response.errcode !== 0;
  if (!failedRet && !failedErrcode) {
    return;
  }
  const detail = [
    response.ret === undefined ? null : `ret=${response.ret}`,
    response.errcode === undefined ? null : `errcode=${response.errcode}`,
    response.errmsg?.trim() ? `errmsg=${response.errmsg.trim()}` : null,
  ].filter(Boolean).join(", ");
  throw new Error(detail ? `weixin ${action} failed: ${detail}` : `weixin ${action} failed`);
}

export async function fetchWeixinJson<T>(params: {
  url: string;
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  timeoutMs: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<T> {
  const { body, method, signal, timeoutMs, token, url } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs));
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(url, {
      method: method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        AuthorizationType: "ilink_bot_token",
        "X-WECHAT-UIN": buildUinHeader(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(params.headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`weixin api ${response.status}: ${text}`);
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function assertWeixinSuccess(response: WeixinBizResponse, action: string): void {
  assertSuccess(response, action);
}

export class HttpWeixinApiClient implements WeixinApiClient {
  readonly fetchUpdates = async (params: {
    baseUrl: string;
    token: string;
    cursor?: string;
    timeoutMs: number;
    signal?: AbortSignal;
  }): Promise<WeixinGetUpdatesResponse> => {
    const { baseUrl, cursor, signal, timeoutMs, token } = params;
    try {
      const response = await fetchWeixinJson<WeixinGetUpdatesResponse>({
        url: new URL("ilink/bot/getupdates", normalizeWeixinBaseUrl(baseUrl)).toString(),
        token,
        timeoutMs,
        signal,
        body: {
          get_updates_buf: cursor ?? "",
          base_info: buildWeixinBaseInfo(),
        },
      });
      assertSuccess(response, "getupdates");
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { ret: 0, msgs: [], get_updates_buf: cursor };
      }
      throw error;
    }
  };

  readonly fetchConfig = async (params: {
    baseUrl: string;
    token: string;
    ilinkUserId: string;
    contextToken: string;
    signal?: AbortSignal;
  }): Promise<WeixinConfigResponse> => {
    const { baseUrl, contextToken, ilinkUserId, signal, token } = params;
    const response = await fetchWeixinJson<WeixinConfigResponse>({
      url: new URL("ilink/bot/getconfig", normalizeWeixinBaseUrl(baseUrl)).toString(),
      token,
      timeoutMs: WEIXIN_API_TIMEOUT_MS,
      signal,
      body: {
        ilink_user_id: ilinkUserId,
        context_token: contextToken,
        base_info: buildWeixinBaseInfo(),
      },
    });
    assertSuccess(response, "getconfig");
    return response;
  };

  readonly sendTyping = async (params: {
    baseUrl: string;
    token: string;
    toUserId: string;
    typingTicket: string;
    status: 1 | 2;
    signal?: AbortSignal;
  }): Promise<WeixinSendTypingResponse> => {
    const { baseUrl, signal, status, toUserId, token, typingTicket } = params;
    const response = await fetchWeixinJson<WeixinSendTypingResponse>({
      url: new URL("ilink/bot/sendtyping", normalizeWeixinBaseUrl(baseUrl)).toString(),
      token,
      timeoutMs: WEIXIN_API_TIMEOUT_MS,
      signal,
      body: {
        ilink_user_id: toUserId,
        typing_ticket: typingTicket,
        status,
        base_info: buildWeixinBaseInfo(),
      },
    });
    assertSuccess(response, "sendtyping");
    return response;
  };

  readonly sendMessageItem = async (params: {
    baseUrl: string;
    token: string;
    toUserId: string;
    item: WeixinMessageItem;
    contextToken?: string;
    signal?: AbortSignal;
  }): Promise<{ messageId: string }> => {
    const { baseUrl, contextToken, item, signal, token, toUserId } = params;
    const clientMessageId = randomUUID();
    const response = await fetchWeixinJson<WeixinBizResponse>({
      url: new URL("ilink/bot/sendmessage", normalizeWeixinBaseUrl(baseUrl)).toString(),
      token,
      timeoutMs: WEIXIN_API_TIMEOUT_MS,
      signal,
      body: {
        msg: {
          from_user_id: "",
          to_user_id: toUserId,
          client_id: clientMessageId,
          message_type: WEIXIN_MESSAGE_TYPE_BOT,
          message_state: WEIXIN_MESSAGE_STATE_FINISH,
          item_list: [item],
          context_token: contextToken ?? "",
        },
        base_info: buildWeixinBaseInfo(),
      },
    });
    assertSuccess(response, "sendmessage");
    return {
      messageId:
        typeof response.message_id === "string"
          ? response.message_id
          : typeof response.message_id === "number"
            ? String(response.message_id)
            : clientMessageId,
    };
  };

  readonly sendTextMessage = async (params: {
    baseUrl: string;
    token: string;
    toUserId: string;
    text: string;
    contextToken?: string;
    signal?: AbortSignal;
  }): Promise<{ messageId: string }> => {
    const { baseUrl, contextToken, signal, text, token, toUserId } = params;
    return await this.sendMessageItem({
      baseUrl,
      token,
      toUserId,
      contextToken,
      signal,
      item: {
        type: WEIXIN_MESSAGE_ITEM_TYPE_TEXT,
        text_item: {
          text: stripSimpleMarkdown(text),
        },
      },
    });
  };
}

export async function sendWeixinMessageItem(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  item: WeixinMessageItem;
  contextToken?: string;
  signal?: AbortSignal;
}): Promise<{ messageId: string }> {
  return await new HttpWeixinApiClient().sendMessageItem(params);
}
