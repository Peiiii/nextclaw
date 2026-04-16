import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { ChatTarget } from "@nextclaw/ncp-toolkit";
import type { NcpMessagePart } from "@nextclaw/ncp";

export type ResolvedWeixinMediaPart = {
  bytes: Uint8Array;
  fileName: string;
  mimeType?: string;
  isImage: boolean;
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
      return {
        bytes,
        fileName,
        mimeType,
        isImage: this.isImageFile(fileName, mimeType),
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
      return {
        bytes,
        fileName,
        mimeType,
        isImage: this.isImageFile(fileName, mimeType),
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
      return {
        bytes,
        fileName,
        mimeType,
        isImage: this.isImageFile(fileName, mimeType),
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
}
