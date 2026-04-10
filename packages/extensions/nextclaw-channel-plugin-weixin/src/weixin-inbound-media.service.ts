import { createDecipheriv, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";
import type { InboundAttachment } from "@nextclaw/core";
import type {
  WeixinCdnMedia,
  WeixinFileItem,
  WeixinImageItem,
  WeixinMessage,
  WeixinMessageItem,
} from "./weixin-api.client.js";

const WEIXIN_INBOUND_MEDIA_MAX_BYTES = 100 * 1024 * 1024;
const FILE_EXTENSION_MIME_MAP: Record<string, string> = {
  ".bmp": "image/bmp",
  ".cjs": "text/javascript",
  ".css": "text/css",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".go": "text/plain",
  ".html": "text/html",
  ".java": "text/plain",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jsx": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".mjs": "text/javascript",
  ".pdf": "application/pdf",
  ".php": "text/plain",
  ".png": "image/png",
  ".py": "text/plain",
  ".rb": "text/plain",
  ".rs": "text/plain",
  ".scss": "text/x-scss",
  ".sh": "text/x-shellscript",
  ".sql": "application/sql",
  ".svg": "image/svg+xml",
  ".swift": "text/plain",
  ".ts": "text/plain",
  ".tsx": "text/plain",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
};

function detectMimeFromBuffer(buffer: Buffer): string | undefined {
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return "application/pdf";
  }
  return undefined;
}

function detectMimeFromFileName(fileName?: string): string | undefined {
  const extension = extname(fileName ?? "").toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  return FILE_EXTENSION_MIME_MAP[extension];
}

function mimeToExtension(contentType?: string, fileName?: string): string {
  const fileExtension = extname(fileName ?? "").trim();
  if (fileExtension) {
    return fileExtension;
  }
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return ".bin";
  }
}

function preferSpecificContentType(params: {
  reportedContentType?: string;
  detectedContentType?: string;
  fileName?: string;
}): string | undefined {
  const normalizedReported = params.reportedContentType?.trim().toLowerCase();
  if (normalizedReported && normalizedReported !== "application/octet-stream") {
    return normalizedReported;
  }
  return params.detectedContentType ?? detectMimeFromFileName(params.fileName) ?? params.reportedContentType;
}

async function saveMediaBuffer(
  buffer: Buffer,
  contentType?: string,
  fileName?: string,
): Promise<{ path: string; contentType?: string }> {
  if (buffer.length > WEIXIN_INBOUND_MEDIA_MAX_BYTES) {
    throw new Error(`media exceeds maxBytes (${buffer.length} > ${WEIXIN_INBOUND_MEDIA_MAX_BYTES})`);
  }
  const resolvedContentType = preferSpecificContentType({
    reportedContentType: contentType,
    detectedContentType: detectMimeFromBuffer(buffer),
    fileName,
  });
  const targetDir = resolve(tmpdir(), "nextclaw-media", "inbound");
  await mkdir(targetDir, { recursive: true });
  const targetPath = resolve(targetDir, `${randomUUID()}${mimeToExtension(resolvedContentType, fileName)}`);
  await writeFile(targetPath, buffer);
  return {
    path: targetPath,
    contentType: resolvedContentType,
  };
}

function parseEncodedAesKey(aesKeyBase64: string): Buffer {
  const decoded = Buffer.from(aesKeyBase64, "base64");
  if (decoded.length === 16) {
    return decoded;
  }
  if (decoded.length === 32 && /^[0-9a-fA-F]{32}$/.test(decoded.toString("ascii"))) {
    return Buffer.from(decoded.toString("ascii"), "hex");
  }
  throw new Error(`unsupported aes_key payload (${decoded.length} bytes after base64 decode)`);
}

function parseAesKey(media?: WeixinCdnMedia, imageItem?: WeixinImageItem): Buffer | undefined {
  const imageHexKey = imageItem?.aeskey?.trim();
  if (imageHexKey) {
    return Buffer.from(imageHexKey, "hex");
  }
  const encoded = media?.aes_key?.trim();
  if (!encoded) {
    return undefined;
  }
  return parseEncodedAesKey(encoded);
}

function decryptAesEcb(ciphertext: Buffer, key: Buffer): Buffer {
  const decipher = createDecipheriv("aes-128-ecb", key, null);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function buildFallbackDownloadUrl(baseUrl: string, encryptedQueryParam: string): string {
  const origin = new URL(baseUrl).origin;
  return `${origin}/download?encrypted_query_param=${encodeURIComponent(encryptedQueryParam)}`;
}

function resolveMediaUrl(media: WeixinCdnMedia | undefined, baseUrl: string): string | undefined {
  const fullUrl = media?.full_url?.trim();
  if (fullUrl) {
    return fullUrl;
  }
  const encryptedQueryParam = media?.encrypt_query_param?.trim();
  if (!encryptedQueryParam) {
    return undefined;
  }
  return buildFallbackDownloadUrl(baseUrl, encryptedQueryParam);
}

async function fetchMediaBuffer(url: string): Promise<{ buffer: Buffer; contentType?: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download failed: ${response.status} ${response.statusText}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? undefined,
  };
}

async function resolveImageAttachment(params: {
  item: WeixinMessageItem;
  baseUrl: string;
}): Promise<InboundAttachment | null> {
  const imageItem = params.item.image_item;
  const media = imageItem?.media;
  const url = resolveMediaUrl(media, params.baseUrl);
  if (!url) {
    return null;
  }

  try {
    const { buffer, contentType } = await fetchMediaBuffer(url);
    const key = parseAesKey(media, imageItem);
    const plaintext = key ? decryptAesEcb(buffer, key) : buffer;
    const saved = await saveMediaBuffer(plaintext, contentType);
    return {
      path: saved.path,
      url,
      mimeType: saved.contentType ?? detectMimeFromBuffer(plaintext) ?? "image/*",
      size: plaintext.length,
      source: "weixin",
      status: "ready",
    };
  } catch {
    return {
      url,
      mimeType: "image/*",
      source: "weixin",
      status: "remote-only",
      errorCode: "download_failed",
    };
  }
}

async function resolveFileAttachment(params: {
  item: WeixinMessageItem;
  baseUrl: string;
}): Promise<InboundAttachment | null> {
  const fileItem: WeixinFileItem | undefined = params.item.file_item;
  const media = fileItem?.media;
  const fileName = fileItem?.file_name?.trim();
  const url = resolveMediaUrl(media, params.baseUrl);
  const hintedMimeType = detectMimeFromFileName(fileName);
  if (!url) {
    return fileName
      ? {
          name: fileName,
          mimeType: hintedMimeType,
          source: "weixin",
          status: "remote-only",
          errorCode: "invalid_payload",
        }
      : null;
  }

  try {
    const { buffer, contentType } = await fetchMediaBuffer(url);
    const key = parseAesKey(media);
    const plaintext = key ? decryptAesEcb(buffer, key) : buffer;
    const saved = await saveMediaBuffer(plaintext, contentType ?? hintedMimeType, fileName);
    return {
      name: fileName,
      path: saved.path,
      url,
      mimeType: saved.contentType ?? hintedMimeType ?? "application/octet-stream",
      size: plaintext.length,
      source: "weixin",
      status: "ready",
    };
  } catch {
    return {
      name: fileName,
      url,
      mimeType: hintedMimeType,
      source: "weixin",
      status: "remote-only",
      errorCode: "download_failed",
    };
  }
}

async function resolveAttachmentFromItem(params: {
  item: WeixinMessageItem;
  baseUrl: string;
}): Promise<InboundAttachment | null> {
  if (params.item.type === 2) {
    return resolveImageAttachment(params);
  }
  if (params.item.type === 4) {
    return resolveFileAttachment(params);
  }
  return null;
}

export async function resolveWeixinInboundAttachments(params: {
  message: WeixinMessage;
  baseUrl: string;
}): Promise<InboundAttachment[]> {
  const items = Array.isArray(params.message.item_list) ? params.message.item_list : [];
  const attachments: InboundAttachment[] = [];
  for (const item of items) {
    const attachment = await resolveAttachmentFromItem({
      item,
      baseUrl: params.baseUrl,
    });
    if (attachment) {
      attachments.push(attachment);
    }
  }
  return attachments;
}
