import { randomInt, randomUUID } from "node:crypto";
import { DEFAULT_WEIXIN_BOT_TYPE, DEFAULT_WEIXIN_POLL_TIMEOUT_MS } from "./weixin-config.js";

type WeixinBaseInfo = {
  channel_version: string;
};

type WeixinTextItem = {
  text?: string;
};

type WeixinVoiceItem = {
  text?: string;
};

type WeixinFileItem = {
  file_name?: string;
};

export type WeixinMessageItem = {
  type?: number;
  text_item?: WeixinTextItem;
  voice_item?: WeixinVoiceItem;
  file_item?: WeixinFileItem;
};

export type WeixinMessage = {
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  message_type?: number;
  item_list?: WeixinMessageItem[];
  context_token?: string;
};

type WeixinQrCodeResponse = {
  qrcode?: string;
  qrcode_img_content?: string;
};

export type WeixinQrStatusResponse = {
  status?: string;
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
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

const WEIXIN_CHANNEL_VERSION = "nextclaw-weixin/0.1.0";
const WEIXIN_MESSAGE_TYPE_BOT = 2;
const WEIXIN_MESSAGE_STATE_FINISH = 2;
const WEIXIN_MESSAGE_ITEM_TYPE_TEXT = 1;
const WEIXIN_MESSAGE_ITEM_TYPE_IMAGE = 2;
const WEIXIN_MESSAGE_ITEM_TYPE_VOICE = 3;
const WEIXIN_MESSAGE_ITEM_TYPE_FILE = 4;
const WEIXIN_MESSAGE_ITEM_TYPE_VIDEO = 5;

function buildWeixinBaseInfo(): WeixinBaseInfo {
  return {
    channel_version: WEIXIN_CHANNEL_VERSION,
  };
}

function normalizeWeixinBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function buildWeixinUinHeader(): string {
  const value = randomInt(0xffffffff);
  return Buffer.from(String(value), "utf8").toString("base64");
}

async function withTimeout<T>(params: {
  timeoutMs: number;
  signal?: AbortSignal;
  handler: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, params.timeoutMs));
  const abort = () => controller.abort();
  params.signal?.addEventListener("abort", abort, { once: true });
  try {
    return await params.handler(controller.signal);
  } finally {
    clearTimeout(timeout);
    params.signal?.removeEventListener("abort", abort);
  }
}

async function fetchWeixinJson<T>(params: {
  url: string;
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  timeoutMs: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<T> {
  return await withTimeout({
    timeoutMs: params.timeoutMs,
    signal: params.signal,
    handler: async (signal) => {
      const response = await fetch(params.url, {
        method: params.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          AuthorizationType: "ilink_bot_token",
          "X-WECHAT-UIN": buildWeixinUinHeader(),
          ...(params.token ? { Authorization: `Bearer ${params.token}` } : {}),
          ...(params.headers ?? {}),
        },
        body: params.body === undefined ? undefined : JSON.stringify(params.body),
        signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`weixin api ${response.status}: ${text}`);
      }
      return JSON.parse(text) as T;
    },
  });
}

export async function fetchWeixinQrCode(params: {
  baseUrl: string;
  botType?: string;
  signal?: AbortSignal;
}): Promise<WeixinQrCodeResponse> {
  const url = new URL(
    `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(params.botType ?? DEFAULT_WEIXIN_BOT_TYPE)}`,
    normalizeWeixinBaseUrl(params.baseUrl),
  );
  return await fetchWeixinJson<WeixinQrCodeResponse>({
    url: url.toString(),
    method: "GET",
    timeoutMs: 15_000,
    signal: params.signal,
  });
}

export async function fetchWeixinConfig(params: {
  baseUrl: string;
  token: string;
  ilinkUserId: string;
  contextToken: string;
  signal?: AbortSignal;
}): Promise<WeixinConfigResponse> {
  return await fetchWeixinJson<WeixinConfigResponse>({
    url: new URL("ilink/bot/getconfig", normalizeWeixinBaseUrl(params.baseUrl)).toString(),
    token: params.token,
    timeoutMs: 15_000,
    signal: params.signal,
    body: {
      ilink_user_id: params.ilinkUserId,
      context_token: params.contextToken,
      base_info: buildWeixinBaseInfo(),
    },
  });
}

export async function sendWeixinTyping(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  typingTicket: string;
  status: 1 | 2;
  signal?: AbortSignal;
}): Promise<WeixinSendTypingResponse> {
  return await fetchWeixinJson<WeixinSendTypingResponse>({
    url: new URL("ilink/bot/sendtyping", normalizeWeixinBaseUrl(params.baseUrl)).toString(),
    token: params.token,
    timeoutMs: 15_000,
    signal: params.signal,
    body: {
      ilink_user_id: params.toUserId,
      typing_ticket: params.typingTicket,
      status: params.status,
      base_info: buildWeixinBaseInfo(),
    },
  });
}

export async function fetchWeixinQrStatus(params: {
  baseUrl: string;
  qrcode: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<WeixinQrStatusResponse> {
  const url = new URL(
    `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(params.qrcode)}`,
    normalizeWeixinBaseUrl(params.baseUrl),
  );
  try {
    return await fetchWeixinJson<WeixinQrStatusResponse>({
      url: url.toString(),
      method: "GET",
      timeoutMs: params.timeoutMs ?? DEFAULT_WEIXIN_POLL_TIMEOUT_MS,
      headers: {
        "iLink-App-ClientVersion": "1",
      },
      signal: params.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "wait" };
    }
    throw error;
  }
}

export async function fetchWeixinUpdates(params: {
  baseUrl: string;
  token: string;
  cursor?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<WeixinGetUpdatesResponse> {
  try {
    return await fetchWeixinJson<WeixinGetUpdatesResponse>({
      url: new URL("ilink/bot/getupdates", normalizeWeixinBaseUrl(params.baseUrl)).toString(),
      token: params.token,
      timeoutMs: params.timeoutMs ?? DEFAULT_WEIXIN_POLL_TIMEOUT_MS,
      signal: params.signal,
      body: {
        get_updates_buf: params.cursor ?? "",
        base_info: buildWeixinBaseInfo(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ret: 0, msgs: [], get_updates_buf: params.cursor };
    }
    throw error;
  }
}

function stripSimpleMarkdown(text: string): string {
  return text
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_~`>#-]+/g, "")
    .trim();
}

export async function sendWeixinTextMessage(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  text: string;
  contextToken?: string;
  signal?: AbortSignal;
}): Promise<{ messageId: string }> {
  const messageId = randomUUID();
  await fetchWeixinJson<Record<string, unknown>>({
    url: new URL("ilink/bot/sendmessage", normalizeWeixinBaseUrl(params.baseUrl)).toString(),
    token: params.token,
    timeoutMs: 15_000,
    signal: params.signal,
    body: {
      msg: {
        from_user_id: "",
        to_user_id: params.toUserId,
        client_id: messageId,
        message_type: WEIXIN_MESSAGE_TYPE_BOT,
        message_state: WEIXIN_MESSAGE_STATE_FINISH,
        item_list: [
          {
            type: WEIXIN_MESSAGE_ITEM_TYPE_TEXT,
            text_item: {
              text: stripSimpleMarkdown(params.text),
            },
          },
        ],
        context_token: params.contextToken ?? "",
      },
      base_info: buildWeixinBaseInfo(),
    },
  });
  return { messageId };
}

export function extractWeixinMessageText(message: WeixinMessage): string {
  const items = Array.isArray(message.item_list) ? message.item_list : [];
  for (const item of items) {
    const text = item.text_item?.text?.trim();
    if (text) {
      return text;
    }
    const voiceText = item.voice_item?.text?.trim();
    if (voiceText) {
      return voiceText;
    }
  }

  for (const item of items) {
    if (item.type === WEIXIN_MESSAGE_ITEM_TYPE_IMAGE) {
      return "[收到图片]";
    }
    if (item.type === WEIXIN_MESSAGE_ITEM_TYPE_VIDEO) {
      return "[收到视频]";
    }
    if (item.type === WEIXIN_MESSAGE_ITEM_TYPE_VOICE) {
      return "[收到语音]";
    }
    if (item.type === WEIXIN_MESSAGE_ITEM_TYPE_FILE) {
      const fileName = item.file_item?.file_name?.trim();
      return fileName ? `[收到文件: ${fileName}]` : "[收到文件]";
    }
  }

  return "";
}
