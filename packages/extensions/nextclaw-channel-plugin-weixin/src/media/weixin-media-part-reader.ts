import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { ChatTarget } from "@nextclaw/ncp-toolkit";
import type { NcpMessagePart } from "@nextclaw/ncp";

export type ResolvedWeixinMediaPart = {
  bytes: Uint8Array;
  fileName: string;
  mimeType?: string;
  isImage: boolean;
  imageWidth?: number;
  imageHeight?: number;
};

const IMAGE_FILE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeMimeType(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const [mimeType] = value.split(";", 1);
  const normalized = mimeType?.trim().toLowerCase();
  return normalized || undefined;
}

function mimeTypeToExtension(mimeType: string | undefined): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    case "application/pdf":
      return ".pdf";
    default:
      return ".bin";
  }
}

function isImageMimeType(mimeType: string | undefined): boolean {
  return Boolean(mimeType?.startsWith("image/"));
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.byteLength < 24) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = view.getUint32(0);
  const ihdr = view.getUint32(12);
  if (signature !== 0x89504e47 || ihdr !== 0x49484452) {
    return null;
  }
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

function readGifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.byteLength < 10) {
    return null;
  }
  const header = Buffer.from(bytes.subarray(0, 6)).toString("ascii");
  if (header !== "GIF87a" && header !== "GIF89a") {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint16(6, true),
    height: view.getUint16(8, true),
  };
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }
    if (offset + 2 > bytes.byteLength) {
      return null;
    }
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.byteLength) {
      return null;
    }
    const isSofMarker =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSofMarker) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += length;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.byteLength < 30) {
    return null;
  }
  const header = Buffer.from(bytes.subarray(0, 4)).toString("ascii");
  const webp = Buffer.from(bytes.subarray(8, 12)).toString("ascii");
  if (header !== "RIFF" || webp !== "WEBP") {
    return null;
  }
  const chunk = Buffer.from(bytes.subarray(12, 16)).toString("ascii");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (chunk === "VP8X" && bytes.byteLength >= 30) {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }
  if (chunk === "VP8 " && bytes.byteLength >= 30) {
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && bytes.byteLength >= 25) {
    const bits =
      bytes[21] |
      (bytes[22] << 8) |
      (bytes[23] << 16) |
      (bytes[24] << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

function readImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  return (
    readPngDimensions(bytes) ??
    readGifDimensions(bytes) ??
    readJpegDimensions(bytes) ??
    readWebpDimensions(bytes)
  );
}

function readFileNameFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const name = basename(parsed.pathname).trim();
    return name || undefined;
  } catch {
    const name = basename(url).trim();
    return name || undefined;
  }
}

export class WeixinMediaPartReader {
  read = async (
    target: ChatTarget,
    part: Extract<NcpMessagePart, { type: "file" }>,
  ): Promise<ResolvedWeixinMediaPart> => {
    if (part.contentBase64) {
      const bytes = Buffer.from(part.contentBase64, "base64");
      const mimeType = normalizeMimeType(part.mimeType);
      const fileName = this.resolveFileName(part, mimeType);
      const imageDimensions = this.resolveImageDimensions(bytes, fileName, mimeType);
      return {
        bytes,
        fileName,
        mimeType,
        isImage: this.isImageFile(fileName, mimeType),
        imageWidth: imageDimensions?.width,
        imageHeight: imageDimensions?.height,
      };
    }

    if (part.assetUri) {
      const contentPath = target.resolveAssetContentPath?.(part.assetUri)?.trim();
      if (!contentPath) {
        throw new Error(
          `weixin send failed: asset "${part.assetUri}" is not readable`,
        );
      }
      const bytes = await readFile(contentPath);
      const mimeType = normalizeMimeType(part.mimeType);
      const fileName = this.resolveFileName(
        part,
        mimeType,
        basename(contentPath),
      );
      const imageDimensions = this.resolveImageDimensions(bytes, fileName, mimeType);
      return {
        bytes,
        fileName,
        mimeType,
        isImage: this.isImageFile(fileName, mimeType),
        imageWidth: imageDimensions?.width,
        imageHeight: imageDimensions?.height,
      };
    }

    if (part.url) {
      const response = await fetch(part.url);
      if (!response.ok) {
        throw new Error(
          `weixin send failed: unable to download ${part.url} (${response.status})`,
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const mimeType =
        normalizeMimeType(part.mimeType) ??
        normalizeMimeType(response.headers.get("content-type") ?? undefined);
      const fileName = this.resolveFileName(
        part,
        mimeType,
        readFileNameFromUrl(part.url),
      );
      const imageDimensions = this.resolveImageDimensions(bytes, fileName, mimeType);
      return {
        bytes,
        fileName,
        mimeType,
        isImage: this.isImageFile(fileName, mimeType),
        imageWidth: imageDimensions?.width,
        imageHeight: imageDimensions?.height,
      };
    }

    throw new Error("weixin send failed: file part is missing content");
  };

  private resolveFileName = (
    part: Extract<NcpMessagePart, { type: "file" }>,
    mimeType?: string,
    fallbackName?: string,
  ): string => {
    const explicitName = readString(part.name);
    if (explicitName) {
      return explicitName;
    }
    if (fallbackName) {
      return fallbackName;
    }
    return `attachment${mimeTypeToExtension(mimeType)}`;
  };

  private isImageFile = (fileName: string, mimeType?: string): boolean => {
    if (isImageMimeType(mimeType)) {
      return true;
    }
    return IMAGE_FILE_EXTENSIONS.has(extname(fileName).toLowerCase());
  };

  private resolveImageDimensions = (
    bytes: Uint8Array,
    fileName: string,
    mimeType?: string,
  ): { width: number; height: number } | null => {
    if (!this.isImageFile(fileName, mimeType)) {
      return null;
    }
    return readImageDimensions(bytes);
  };
}
