import type {
  NcpToolOutputContentItem,
  NcpToolOutputImageItem,
  OpenAIContentPart,
} from "@nextclaw/ncp";

import {
  isBinaryLike,
  isLargeDataUrl,
  readDataUrlMime,
  readStringField,
  sanitizePositiveInt,
  truncateMiddle,
} from "./tool-result-content.utils.js";

const LARGE_INLINE_PAYLOAD_CHARS = 2_048;
const DEFAULT_MAX_MODEL_VISIBLE_IMAGES = 4;
const DEFAULT_MAX_ARRAY_ITEMS = 50;
const DEFAULT_MAX_OBJECT_KEYS = 80;
const DEFAULT_MAX_DEPTH = 8;

type ImageCollectionContext = {
  depth: number;
};

export type ToolResultImageServiceOptions = {
  maxModelVisibleImages?: number;
  maxArrayItems?: number;
  maxObjectKeys?: number;
  maxDepth?: number;
};

export class ToolResultImageService {
  private readonly maxModelVisibleImages: number;
  private readonly maxArrayItems: number;
  private readonly maxObjectKeys: number;
  private readonly maxDepth: number;

  constructor(options: ToolResultImageServiceOptions = {}) {
    this.maxModelVisibleImages = sanitizePositiveInt(
      options.maxModelVisibleImages,
      DEFAULT_MAX_MODEL_VISIBLE_IMAGES,
    );
    this.maxArrayItems = sanitizePositiveInt(options.maxArrayItems, DEFAULT_MAX_ARRAY_ITEMS);
    this.maxObjectKeys = sanitizePositiveInt(options.maxObjectKeys, DEFAULT_MAX_OBJECT_KEYS);
    this.maxDepth = sanitizePositiveInt(options.maxDepth, DEFAULT_MAX_DEPTH);
  }

  extractImageItems = (value: unknown): NcpToolOutputImageItem[] => {
    const images: NcpToolOutputImageItem[] = [];
    this.collectImageItems(value, images, { depth: 0 });
    return images;
  };

  readVisibleImages = (
    contentItems: ReadonlyArray<NcpToolOutputContentItem> | undefined,
  ): NcpToolOutputImageItem[] => {
    if (!contentItems) {
      return [];
    }
    return contentItems
      .filter((item): item is NcpToolOutputImageItem => item.type === "input_image")
      .slice(0, this.maxModelVisibleImages);
  };

  toOpenAiImagePart = (item: NcpToolOutputImageItem): OpenAIContentPart => ({
    type: "image_url",
    image_url: {
      url: item.imageUrl,
      ...(item.detail ? { detail: toOpenAiImageDetail(item.detail) } : {}),
    },
  });

  summarizeImageContentItem = (value: Record<string, unknown>): Record<string, unknown> | null => {
    const type = readStringField(value, "type");
    if (type === "image") {
      return {
        type: "image",
        mimeType: readStringField(value, "mimeType") ?? readStringField(value, "mime_type"),
        detail: readImageDetail(value),
        dataOmitted: true,
        originalDataChars: readStringField(value, "data")?.length ?? 0,
      };
    }
    if (type === "input_image" || type === "image_url") {
      const imageUrl = readImageUrl(value);
      return {
        type,
        imageUrl: imageUrl ? redactImageUrl(imageUrl) : undefined,
        detail: readImageDetail(value),
      };
    }
    return null;
  };

  private readonly collectImageItems = (
    value: unknown,
    output: NcpToolOutputImageItem[],
    context: ImageCollectionContext,
  ): void => {
    if (output.length >= this.maxModelVisibleImages || context.depth > this.maxDepth) {
      return;
    }
    if (typeof value === "string") {
      const image = imageDataUrlToContentItem(value);
      if (image) {
        output.push(image);
      }
      return;
    }
    if (!value || typeof value !== "object" || isBinaryLike(value)) {
      return;
    }
    if (Array.isArray(value)) {
      value
        .slice(0, this.maxArrayItems)
        .forEach((item) => this.collectImageItems(item, output, { depth: context.depth + 1 }));
      return;
    }
    const image = readImageContentItem(value as Record<string, unknown>);
    if (image) {
      output.push(image);
      return;
    }
    Object.values(value as Record<string, unknown>)
      .slice(0, this.maxObjectKeys)
      .forEach((item) => this.collectImageItems(item, output, { depth: context.depth + 1 }));
  };
}

function imageDataUrlToContentItem(value: string): NcpToolOutputImageItem | null {
  if (!/^data:image\/[^,]+;base64,/i.test(value)) {
    return null;
  }
  return {
    type: "input_image",
    imageUrl: value,
    mimeType: readDataUrlMime(value),
    originalDataChars: value.length,
  };
}

function readImageContentItem(value: Record<string, unknown>): NcpToolOutputImageItem | null {
  const type = readStringField(value, "type");
  if (type === "image") {
    const data = readStringField(value, "data");
    const mimeType =
      readStringField(value, "mimeType") ?? readStringField(value, "mime_type") ?? "image/png";
    if (!data) {
      return null;
    }
    return {
      type: "input_image",
      imageUrl: `data:${mimeType};base64,${data}`,
      mimeType,
      detail: readImageDetail(value),
      originalDataChars: data.length,
    };
  }
  if (type === "input_image" || type === "image_url") {
    const imageUrl = readImageUrl(value);
    if (!imageUrl) {
      return null;
    }
    return {
      type: "input_image",
      imageUrl,
      detail: readImageDetail(value),
    };
  }
  return null;
}

function toOpenAiImageDetail(
  detail: NcpToolOutputImageItem["detail"],
): "low" | "high" | "auto" | undefined {
  if (detail === "low" || detail === "high" || detail === "auto") {
    return detail;
  }
  if (detail === "original") {
    return "high";
  }
  return undefined;
}

function readImageDetail(
  value: Record<string, unknown>,
): "low" | "high" | "auto" | "original" | undefined {
  const direct = readStringField(value, "detail");
  if (isImageDetail(direct)) {
    return direct;
  }
  const meta = value._meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  const codexDetail = readStringField(meta as Record<string, unknown>, "codex/imageDetail");
  return isImageDetail(codexDetail) ? codexDetail : undefined;
}

function isImageDetail(value: string | null): value is "low" | "high" | "auto" | "original" {
  return value === "low" || value === "high" || value === "auto" || value === "original";
}

function readImageUrl(value: Record<string, unknown>): string | null {
  const direct = readStringField(value, "image_url");
  if (direct) {
    return direct;
  }
  const nested = value.image_url;
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return null;
  }
  return readStringField(nested as Record<string, unknown>, "url");
}

function redactImageUrl(value: string): string {
  if (isLargeDataUrl(value)) {
    return `[omitted data URL payload: mime=${readDataUrlMime(value)}, originalChars=${value.length}]`;
  }
  return value.length > LARGE_INLINE_PAYLOAD_CHARS
    ? truncateMiddle(value, LARGE_INLINE_PAYLOAD_CHARS)
    : value;
}
