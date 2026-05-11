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
} from "../services/weixin-api.service.js";
import type { WeixinMessageItem } from "../services/weixin-api.service.js";

type WeixinUploadUrlResponse = {
  upload_param?: string;
  upload_full_url?: string;
};

type UploadedWeixinMedia = {
  downloadEncryptedQueryParam: string;
  aesKeyHex: string;
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

function encodeWeixinMediaAesKey(aesKeyHex: string): string {
  return Buffer.from(aesKeyHex, "utf8").toString("base64");
}

async function withUploadTimeout<T>(params: {
  timeoutMs: number;
  signal?: AbortSignal;
  handler: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const { handler, signal: parentSignal, timeoutMs } = params;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1_000, timeoutMs),
  );
  const abort = () => controller.abort();
  parentSignal?.addEventListener("abort", abort, { once: true });
  try {
    return await handler(controller.signal);
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abort);
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
  const { aesKeyHex, baseUrl, bytes, fileKey, mediaType, signal, toUserId, token } = params;
  const rawFileMd5 = createHash("md5")
    .update(Buffer.from(bytes))
    .digest("hex");
  return await fetchWeixinJson<WeixinUploadUrlResponse>({
    url: new URL(
      "ilink/bot/getuploadurl",
      normalizeWeixinBaseUrl(baseUrl),
    ).toString(),
    token,
    timeoutMs: WEIXIN_API_TIMEOUT_MS,
    signal,
    body: {
      filekey: fileKey,
      media_type: mediaType,
      to_user_id: toUserId,
      rawsize: bytes.byteLength,
      rawfilemd5: rawFileMd5,
      filesize: computeEncryptedSize(bytes.byteLength),
      no_need_thumb: true,
      aeskey: aesKeyHex,
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
  const { aesKey, baseUrl, bytes, fileKey, signal, uploadFullUrl, uploadParam } = params;
  const uploadUrl = uploadFullUrl?.trim()
    ? uploadFullUrl.trim()
    : uploadParam
      ? buildWeixinUploadUrl({
          baseUrl,
          uploadParam,
          fileKey,
        })
      : null;
  if (!uploadUrl) {
    throw new Error("weixin upload failed: upload url is missing");
  }

  const ciphertext = encryptWeixinBytes(bytes, aesKey);
  const response = await withUploadTimeout({
    timeoutMs: WEIXIN_UPLOAD_TIMEOUT_MS,
    signal,
    handler: async (signal) =>
      fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(ciphertext),
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
    aesKeyHex: aesKey.toString("hex"),
    fileSize: bytes.byteLength,
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
  const { baseUrl, bytes, contextToken, item, mediaType, signal, toUserId, token } = params;
  const fileKey = randomBytes(16).toString("hex");
  const aesKey = randomBytes(16);
  const uploadUrl = await fetchWeixinUploadUrl({
    baseUrl,
    token,
    toUserId,
    fileKey,
    mediaType,
    bytes,
    aesKeyHex: aesKey.toString("hex"),
    signal,
  });
  const uploaded = await uploadWeixinMedia({
    baseUrl,
    uploadParam: uploadUrl.upload_param,
    uploadFullUrl: uploadUrl.upload_full_url,
    fileKey,
    bytes,
    aesKey,
    signal,
  });
  return await sendWeixinMessageItem({
    baseUrl,
    token,
    toUserId,
    contextToken,
    signal,
    item: item(uploaded),
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
  const { baseUrl, bytes, contextToken, fileName, signal, toUserId, token } = params;
  return await sendUploadedWeixinMediaItem({
    baseUrl,
    token,
    toUserId,
    bytes,
    contextToken,
    mediaType: WEIXIN_UPLOAD_MEDIA_TYPE_FILE,
    signal,
    item: (uploaded) => ({
      type: WEIXIN_MESSAGE_ITEM_TYPE_FILE,
      file_item: {
        file_name: fileName,
        len: String(uploaded.fileSize),
        media: {
          encrypt_query_param: uploaded.downloadEncryptedQueryParam,
          aes_key: encodeWeixinMediaAesKey(uploaded.aesKeyHex),
          encrypt_type: WEIXIN_MEDIA_ENCRYPT_TYPE_PACKED,
        },
      },
    }),
  });
}

export async function sendWeixinImageMessage(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  bytes: Uint8Array;
  width?: number;
  height?: number;
  contextToken?: string;
  signal?: AbortSignal;
}): Promise<{ messageId: string }> {
  const { baseUrl, bytes, contextToken, signal, toUserId, token } = params;
  return await sendUploadedWeixinMediaItem({
    baseUrl,
    token,
    toUserId,
    bytes,
    contextToken,
    mediaType: WEIXIN_UPLOAD_MEDIA_TYPE_IMAGE,
    signal,
    item: (uploaded) => ({
      type: WEIXIN_MESSAGE_ITEM_TYPE_IMAGE,
      image_item: {
        media: {
          encrypt_query_param: uploaded.downloadEncryptedQueryParam,
          aes_key: encodeWeixinMediaAesKey(uploaded.aesKeyHex),
          encrypt_type: WEIXIN_MEDIA_ENCRYPT_TYPE_PACKED,
        },
        mid_size: uploaded.fileSizeCiphertext,
      },
    }),
  });
}
