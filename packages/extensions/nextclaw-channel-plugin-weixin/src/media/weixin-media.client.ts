import { createCipheriv, createHash, randomBytes } from "node:crypto";
import {
  WEIXIN_API_TIMEOUT_MS,
  WEIXIN_MEDIA_ENCRYPT_TYPE_PACKED,
  WEIXIN_MESSAGE_ITEM_TYPE_FILE,
  WEIXIN_MESSAGE_ITEM_TYPE_IMAGE,
  WEIXIN_UPLOAD_MEDIA_TYPE_FILE,
  WEIXIN_UPLOAD_MEDIA_TYPE_IMAGE,
  buildWeixinBaseInfo,
  fetchWeixinJson,
  normalizeWeixinBaseUrl,
  sendWeixinMessageItem,
} from "../weixin-api.client.js";
import type { WeixinMessageItem } from "../weixin-api.client.js";

type WeixinUploadUrlResponse = {
  upload_param?: string;
  upload_full_url?: string;
};

type UploadedWeixinMedia = {
  downloadEncryptedQueryParam: string;
  aesKeyBase64: string;
  fileSize: number;
  fileSizeCiphertext: number;
};

const WEIXIN_UPLOAD_TIMEOUT_MS = 60_000;

function buildWeixinUploadUrl(params: {
  baseUrl: string;
  uploadParam: string;
  fileKey: string;
}): string {
  const origin = new URL(params.baseUrl).origin;
  const query = new URLSearchParams({
    encrypted_query_param: params.uploadParam,
    filekey: params.fileKey,
  });
  return `${origin}/upload?${query.toString()}`;
}

function computeEncryptedSize(size: number): number {
  const blockSize = 16;
  const remainder = size % blockSize;
  return size + (remainder === 0 ? blockSize : blockSize - remainder);
}

function encryptWeixinBytes(bytes: Uint8Array, aesKey: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-ecb", aesKey, null);
  return Buffer.concat([cipher.update(Buffer.from(bytes)), cipher.final()]);
}

async function withUploadTimeout<T>(params: {
  timeoutMs: number;
  signal?: AbortSignal;
  handler: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1_000, params.timeoutMs),
  );
  const abort = () => controller.abort();
  params.signal?.addEventListener("abort", abort, { once: true });
  try {
    return await params.handler(controller.signal);
  } finally {
    clearTimeout(timeout);
    params.signal?.removeEventListener("abort", abort);
  }
}

async function fetchWeixinUploadUrl(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  fileKey: string;
  mediaType: number;
  bytes: Uint8Array;
  aesKeyHex: string;
  signal?: AbortSignal;
}): Promise<WeixinUploadUrlResponse> {
  const rawFileMd5 = createHash("md5")
    .update(Buffer.from(params.bytes))
    .digest("hex");
  return await fetchWeixinJson<WeixinUploadUrlResponse>({
    url: new URL(
      "ilink/bot/getuploadurl",
      normalizeWeixinBaseUrl(params.baseUrl),
    ).toString(),
    token: params.token,
    timeoutMs: WEIXIN_API_TIMEOUT_MS,
    signal: params.signal,
    body: {
      filekey: params.fileKey,
      media_type: params.mediaType,
      to_user_id: params.toUserId,
      rawsize: params.bytes.byteLength,
      rawfilemd5: rawFileMd5,
      filesize: computeEncryptedSize(params.bytes.byteLength),
      no_need_thumb: true,
      aeskey: params.aesKeyHex,
      base_info: buildWeixinBaseInfo(),
    },
  });
}

async function uploadWeixinMedia(params: {
  baseUrl: string;
  uploadParam?: string;
  uploadFullUrl?: string;
  fileKey: string;
  bytes: Uint8Array;
  aesKey: Buffer;
  signal?: AbortSignal;
}): Promise<UploadedWeixinMedia> {
  const uploadUrl = params.uploadFullUrl?.trim()
    ? params.uploadFullUrl.trim()
    : params.uploadParam
      ? buildWeixinUploadUrl({
          baseUrl: params.baseUrl,
          uploadParam: params.uploadParam,
          fileKey: params.fileKey,
        })
      : null;
  if (!uploadUrl) {
    throw new Error("weixin upload failed: upload url is missing");
  }

  const ciphertext = encryptWeixinBytes(params.bytes, params.aesKey);
  const response = await withUploadTimeout({
    timeoutMs: WEIXIN_UPLOAD_TIMEOUT_MS,
    signal: params.signal,
    handler: async (signal) =>
      fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: ciphertext,
        signal,
      }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `weixin upload failed: ${response.status} ${message || response.statusText}`,
    );
  }

  const downloadEncryptedQueryParam =
    response.headers.get("x-encrypted-param")?.trim();
  if (!downloadEncryptedQueryParam) {
    throw new Error("weixin upload failed: x-encrypted-param is missing");
  }

  return {
    downloadEncryptedQueryParam,
    aesKeyBase64: params.aesKey.toString("base64"),
    fileSize: params.bytes.byteLength,
    fileSizeCiphertext: ciphertext.byteLength,
  };
}

async function sendUploadedWeixinMediaItem(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  contextToken?: string;
  bytes: Uint8Array;
  mediaType: number;
  item: (uploaded: UploadedWeixinMedia) => WeixinMessageItem;
  signal?: AbortSignal;
}): Promise<{ messageId: string }> {
  const fileKey = randomBytes(16).toString("hex");
  const aesKey = randomBytes(16);
  const uploadUrl = await fetchWeixinUploadUrl({
    baseUrl: params.baseUrl,
    token: params.token,
    toUserId: params.toUserId,
    fileKey,
    mediaType: params.mediaType,
    bytes: params.bytes,
    aesKeyHex: aesKey.toString("hex"),
    signal: params.signal,
  });
  const uploaded = await uploadWeixinMedia({
    baseUrl: params.baseUrl,
    uploadParam: uploadUrl.upload_param,
    uploadFullUrl: uploadUrl.upload_full_url,
    fileKey,
    bytes: params.bytes,
    aesKey,
    signal: params.signal,
  });
  return await sendWeixinMessageItem({
    baseUrl: params.baseUrl,
    token: params.token,
    toUserId: params.toUserId,
    contextToken: params.contextToken,
    signal: params.signal,
    item: params.item(uploaded),
  });
}

export async function sendWeixinImageMessage(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  bytes: Uint8Array;
  contextToken?: string;
  signal?: AbortSignal;
}): Promise<{ messageId: string }> {
  return await sendUploadedWeixinMediaItem({
    baseUrl: params.baseUrl,
    token: params.token,
    toUserId: params.toUserId,
    bytes: params.bytes,
    contextToken: params.contextToken,
    mediaType: WEIXIN_UPLOAD_MEDIA_TYPE_IMAGE,
    signal: params.signal,
    item: (uploaded) => ({
      type: WEIXIN_MESSAGE_ITEM_TYPE_IMAGE,
      image_item: {
        media: {
          encrypt_query_param: uploaded.downloadEncryptedQueryParam,
          aes_key: uploaded.aesKeyBase64,
          encrypt_type: WEIXIN_MEDIA_ENCRYPT_TYPE_PACKED,
        },
        mid_size: uploaded.fileSizeCiphertext,
      },
    }),
  });
}

export async function sendWeixinFileMessage(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  fileName: string;
  bytes: Uint8Array;
  contextToken?: string;
  signal?: AbortSignal;
}): Promise<{ messageId: string }> {
  return await sendUploadedWeixinMediaItem({
    baseUrl: params.baseUrl,
    token: params.token,
    toUserId: params.toUserId,
    bytes: params.bytes,
    contextToken: params.contextToken,
    mediaType: WEIXIN_UPLOAD_MEDIA_TYPE_FILE,
    signal: params.signal,
    item: (uploaded) => ({
      type: WEIXIN_MESSAGE_ITEM_TYPE_FILE,
      file_item: {
        file_name: params.fileName,
        len: String(uploaded.fileSize),
        media: {
          encrypt_query_param: uploaded.downloadEncryptedQueryParam,
          aes_key: uploaded.aesKeyBase64,
          encrypt_type: WEIXIN_MEDIA_ENCRYPT_TYPE_PACKED,
        },
      },
    }),
  });
}
