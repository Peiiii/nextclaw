import { readFileSync } from "node:fs";
import type { NcpMessagePart, OpenAIContentPart } from "@nextclaw/ncp";
import type { LocalAssetStore } from "./asset-store.js";

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatAssetReferenceBlock(params: {
  fileName?: string | null;
  mimeType?: string | null;
  assetUri?: string | null;
  url?: string | null;
  sizeBytes?: number;
}): string {
  const fileName = readOptionalString(params.fileName) ?? "asset";
  const mimeType = readOptionalString(params.mimeType) ?? "application/octet-stream";
  const assetUri = readOptionalString(params.assetUri);
  const url = readOptionalString(params.url);
  const sizeText =
    typeof params.sizeBytes === "number" && Number.isFinite(params.sizeBytes)
      ? String(params.sizeBytes)
      : null;

  const lines = [
    `[Asset: ${fileName}]`,
    `[MIME: ${mimeType}]`,
    ...(assetUri ? [`[Asset URI: ${assetUri}]`] : []),
    ...(sizeText ? [`[Size Bytes: ${sizeText}]`] : []),
    ...(url ? [`[Preview URL: ${url}]`] : []),
    "[Instruction: This file is not embedded in the prompt. If you need to inspect or transform it, use asset_export to copy it to a normal file path first.]",
  ];
  return lines.join("\n");
}

type ResolvedFilePart = {
  fileName: string;
  mimeType: string;
  assetUri: string | null;
  url: string | null;
  contentBase64: string | null;
  sizeBytes?: number;
  contentPath: string | null;
};

function resolveFilePart(
  part: Extract<NcpMessagePart, { type: "file" }>,
  assetStore?: LocalAssetStore | null,
): ResolvedFilePart {
  const assetUri = readOptionalString(part.assetUri);
  const stored = assetUri ? assetStore?.getByUri(assetUri) : null;
  return {
    fileName: readOptionalString(stored?.fileName) ?? readOptionalString(part.name) ?? "asset",
    mimeType:
      readOptionalString(stored?.mimeType) ??
      readOptionalString(part.mimeType) ??
      "application/octet-stream",
    assetUri,
    url: readOptionalString(part.url),
    contentBase64: readOptionalString(part.contentBase64),
    sizeBytes: stored?.sizeBytes ?? (typeof part.sizeBytes === "number" ? part.sizeBytes : undefined),
    contentPath: assetUri ? assetStore?.resolveContentPath(assetUri) ?? null : null,
  };
}

function formatImageAttachmentHint(params: {
  fileName?: string | null;
  mimeType?: string | null;
  assetUri?: string | null;
  sizeBytes?: number;
}): string {
  const {
    fileName: rawFileName,
    mimeType: rawMimeType,
    assetUri: rawAssetUri,
    sizeBytes,
  } = params;
  const fileName = readOptionalString(rawFileName) ?? "asset";
  const mimeType = readOptionalString(rawMimeType) ?? "application/octet-stream";
  const assetUri = readOptionalString(rawAssetUri);
  const sizeText =
    typeof sizeBytes === "number" && Number.isFinite(sizeBytes)
      ? String(sizeBytes)
      : null;

  const lines = [
    `[Attached Image: ${fileName}]`,
    `[MIME: ${mimeType}]`,
    ...(assetUri ? [`[Asset URI: ${assetUri}]`] : []),
    ...(sizeText ? [`[Size Bytes: ${sizeText}]`] : []),
    assetUri
      ? "[Instruction: This image is embedded in the prompt. If you need to transform or process the original file with tools, use the asset URI.]"
      : "[Instruction: This image is embedded in the prompt.]",
  ];
  return lines.join("\n");
}

function isImageMimeType(value: string | null): boolean {
  return value?.startsWith("image/") ?? false;
}

function isModelReachableImageUrl(value: string | null): boolean {
  return value !== null && (/^https?:\/\//i.test(value) || /^data:/i.test(value));
}

function buildImageDataUrl(mimeType: string, bytes: Uint8Array): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function resolveImageContentPart(
  part: Extract<NcpMessagePart, { type: "file" }>,
  assetStore?: LocalAssetStore | null,
): OpenAIContentPart | null {
  const resolved = resolveFilePart(part, assetStore);
  if (!isImageMimeType(resolved.mimeType)) {
    return null;
  }

  if (resolved.contentBase64) {
    return {
      type: "image_url",
      image_url: {
        url: `data:${resolved.mimeType};base64,${resolved.contentBase64}`,
        detail: "auto",
      },
    };
  }

  if (resolved.contentPath) {
    return {
      type: "image_url",
      image_url: {
        url: buildImageDataUrl(resolved.mimeType, readFileSync(resolved.contentPath)),
        detail: "auto",
      },
    };
  }

  if (isModelReachableImageUrl(resolved.url)) {
    return {
      type: "image_url",
      image_url: {
        url: resolved.url,
        detail: "auto",
      },
    };
  }

  return null;
}

function resolveImageAttachmentHint(
  part: Extract<NcpMessagePart, { type: "file" }>,
  assetStore?: LocalAssetStore | null,
): string | null {
  const resolved = resolveFilePart(part, assetStore);
  if (!isImageMimeType(resolved.mimeType)) {
    return null;
  }

  return formatImageAttachmentHint({
    fileName: resolved.fileName,
    mimeType: resolved.mimeType,
    assetUri: resolved.assetUri,
    sizeBytes: resolved.sizeBytes,
  });
}

function resolveAssetReferenceBlock(
  part: Extract<NcpMessagePart, { type: "file" }>,
  assetStore?: LocalAssetStore | null,
): string | null {
  const resolved = resolveFilePart(part, assetStore);

  if (resolved.assetUri) {
    return formatAssetReferenceBlock({
      fileName: resolved.fileName,
      mimeType: resolved.mimeType,
      assetUri: resolved.assetUri,
      url: resolved.url,
      sizeBytes: resolved.sizeBytes,
    });
  }

  if (resolved.url || resolved.contentBase64) {
    return formatAssetReferenceBlock({
      fileName: resolved.fileName,
      mimeType: resolved.mimeType,
      url: resolved.url,
      sizeBytes: resolved.sizeBytes,
    });
  }

  return null;
}

export function buildNcpUserContent(
  parts: NcpMessagePart[],
  options: {
    assetStore?: LocalAssetStore | null;
  } = {},
): string | OpenAIContentPart[] {
  const content: OpenAIContentPart[] = [];

  for (const part of parts) {
    if ((part.type === "text" || part.type === "rich-text") && part.text.trim().length > 0) {
      content.push({ type: "text", text: part.text });
      continue;
    }

    if (part.type !== "file") {
      continue;
    }

    const imageContentPart = resolveImageContentPart(part, options.assetStore);
    if (imageContentPart) {
      content.push(imageContentPart);
      const imageAttachmentHint = resolveImageAttachmentHint(part, options.assetStore);
      if (imageAttachmentHint) {
        content.push({ type: "text", text: imageAttachmentHint });
      }
      continue;
    }

    const assetReferenceBlock = resolveAssetReferenceBlock(part, options.assetStore);
    if (assetReferenceBlock) {
      content.push({ type: "text", text: assetReferenceBlock });
    }
  }

  if (content.length === 0) {
    return "";
  }
  if (content.length === 1 && content[0]?.type === "text") {
    return content[0].text;
  }
  return content;
}
