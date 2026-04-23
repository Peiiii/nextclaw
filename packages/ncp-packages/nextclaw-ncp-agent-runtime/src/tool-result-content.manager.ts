import type {
  NcpLLMApiInput,
  NcpToolCallResult,
  NcpToolOutputContentItem,
  NcpToolOutputImageItem,
  OpenAIChatMessage,
} from "@nextclaw/ncp";

import {
  getBinaryByteLength,
  isBinaryLike,
  isLargeBase64LikeString,
  isLargeDataUrl,
  readDataUrlMime,
  sanitizePositiveInt,
  serializeValue,
  truncateMiddle,
} from "./tool-result-content.utils.js";
import { ToolResultImageService } from "./tool-result-image.service.js";

const DEFAULT_MAX_MODEL_VISIBLE_CHARS = 10_000;
const DEFAULT_MAX_TOOL_MESSAGES_CHARS = 60_000;
const DEFAULT_MAX_STRING_VALUE_CHARS = 4_000;
const DEFAULT_MAX_MODEL_VISIBLE_IMAGES = 4;
const DEFAULT_MAX_ARRAY_ITEMS = 50;
const DEFAULT_MAX_OBJECT_KEYS = 80;
const DEFAULT_MAX_DEPTH = 8;
const TRUNCATION_MARKER = "[NextClaw tool result truncated]";

type ToolResultContentContext = {
  toolCallId?: string;
  toolName?: string;
};

export type ToolResultContentManagerOptions = {
  maxModelVisibleChars?: number;
  maxToolMessagesChars?: number;
  maxStringValueChars?: number;
  maxModelVisibleImages?: number;
  maxArrayItems?: number;
  maxObjectKeys?: number;
  maxDepth?: number;
};

type RedactContext = {
  depth: number;
};

type NormalizeOutcome = {
  value: unknown;
  changed: boolean;
};

export class ToolResultContentManager {
  private readonly maxModelVisibleChars: number;
  private readonly maxToolMessagesChars: number;
  private readonly maxStringValueChars: number;
  private readonly maxModelVisibleImages: number;
  private readonly maxArrayItems: number;
  private readonly maxObjectKeys: number;
  private readonly maxDepth: number;
  private readonly imageService: ToolResultImageService;

  constructor(options: ToolResultContentManagerOptions = {}) {
    this.maxModelVisibleChars = sanitizePositiveInt(
      options.maxModelVisibleChars,
      DEFAULT_MAX_MODEL_VISIBLE_CHARS,
    );
    this.maxToolMessagesChars = sanitizePositiveInt(
      options.maxToolMessagesChars,
      DEFAULT_MAX_TOOL_MESSAGES_CHARS,
    );
    this.maxStringValueChars = sanitizePositiveInt(
      options.maxStringValueChars,
      DEFAULT_MAX_STRING_VALUE_CHARS,
    );
    this.maxModelVisibleImages = sanitizePositiveInt(
      options.maxModelVisibleImages,
      DEFAULT_MAX_MODEL_VISIBLE_IMAGES,
    );
    this.maxArrayItems = sanitizePositiveInt(options.maxArrayItems, DEFAULT_MAX_ARRAY_ITEMS);
    this.maxObjectKeys = sanitizePositiveInt(options.maxObjectKeys, DEFAULT_MAX_OBJECT_KEYS);
    this.maxDepth = sanitizePositiveInt(options.maxDepth, DEFAULT_MAX_DEPTH);
    this.imageService = new ToolResultImageService({
      maxModelVisibleImages: this.maxModelVisibleImages,
      maxArrayItems: this.maxArrayItems,
      maxObjectKeys: this.maxObjectKeys,
      maxDepth: this.maxDepth,
    });
  }

  normalizeToolCallResult = (result: NcpToolCallResult): NcpToolCallResult => {
    const context = {
      toolCallId: result.toolCallId,
      toolName: result.toolName,
    };
    const normalized = this.normalizeResult(result.result, {
      toolCallId: result.toolCallId,
      toolName: result.toolName,
    });
    const contentItems = this.buildContentItems(result.result, normalized.value, context);
    return {
      ...result,
      ...(normalized.changed ? { result: normalized.value } : {}),
      contentItems,
    };
  };

  compactInput = (input: NcpLLMApiInput): NcpLLMApiInput => ({
    ...input,
    messages: this.compactToolMessages(input.messages),
  });

  toModelContent = (result: unknown, context: ToolResultContentContext = {}): string => {
    const normalized = this.normalizeResult(result, context);
    const serialized = serializeValue(normalized.value);
    if (serialized.text.length <= this.maxModelVisibleChars) {
      return serialized.text;
    }
    return this.boundModelContentText(
      JSON.stringify(
        this.buildEnvelope({
          context,
          originalSerializedChars: serialized.text.length,
          previewSource: serialized.text,
        }),
      ),
    );
  };

  toVisualObservationMessages = (
    toolResults: ReadonlyArray<NcpToolCallResult>,
  ): OpenAIChatMessage[] => {
    return toolResults.flatMap((result) => {
      const images = this.readVisibleImages(result.contentItems);
      if (images.length === 0) {
        return [];
      }
      return [this.buildVisualObservationMessage(result, images)];
    });
  };

  private readonly normalizeResult = (
    result: unknown,
    context: ToolResultContentContext,
  ): NormalizeOutcome => {
    if (typeof result === "string") {
      return this.normalizeStringResult(result, context);
    }

    const serialized = serializeValue(result);
    if (serialized.ok && serialized.text.length <= this.maxModelVisibleChars) {
      return { value: result, changed: false };
    }

    const redacted = this.redactValue(result, { depth: 0 });
    const redactedSerialized = serializeValue(redacted);
    if (redactedSerialized.text.length <= this.maxModelVisibleChars) {
      return {
        value: this.attachNotice(redacted, {
          context,
          originalSerializedChars: serialized.text.length,
        }),
        changed: true,
      };
    }

    return {
      value: this.buildEnvelope({
        context,
        originalSerializedChars: serialized.text.length,
        previewSource: redactedSerialized.text,
      }),
      changed: true,
    };
  };

  private readonly buildContentItems = (
    rawResult: unknown,
    normalizedResult: unknown,
    context: ToolResultContentContext,
  ): NcpToolOutputContentItem[] => {
    const text = this.toModelContent(normalizedResult, context);
    return [
      { type: "input_text", text },
      ...this.imageService.extractImageItems(rawResult).slice(0, this.maxModelVisibleImages),
    ];
  };

  private readonly readVisibleImages = (
    contentItems: ReadonlyArray<NcpToolOutputContentItem> | undefined,
  ): NcpToolOutputImageItem[] => this.imageService.readVisibleImages(contentItems);

  private readonly buildVisualObservationMessage = (
    toolResult: NcpToolCallResult,
    images: NcpToolOutputImageItem[],
  ): OpenAIChatMessage => {
    const imageParts = images.map(this.imageService.toOpenAiImagePart);
    const omittedCount = Math.max(
      0,
      (toolResult.contentItems ?? []).filter((item) => item.type === "input_image").length -
        imageParts.length,
    );
    return {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            `Tool "${toolResult.toolName}" returned ${imageParts.length} image(s).`,
            "Use the attached image content as the visual observation for the preceding tool result.",
            omittedCount > 0 ? `${omittedCount} additional image(s) were omitted by budget.` : "",
          ]
            .filter(Boolean)
            .join(" "),
        },
        ...imageParts,
      ],
    };
  };

  private readonly compactToolMessages = (
    messages: ReadonlyArray<OpenAIChatMessage>,
  ): OpenAIChatMessage[] => {
    let remainingChars = this.maxToolMessagesChars;
    const output = messages.slice();
    for (let index = output.length - 1; index >= 0; index -= 1) {
      const message = output[index];
      if (message.role !== "tool") {
        continue;
      }
      const compacted = this.compactToolMessage(message, remainingChars);
      output[index] = compacted.message;
      remainingChars = compacted.remainingChars;
    }
    return output;
  };

  private readonly compactToolMessage = (
    message: Extract<OpenAIChatMessage, { role: "tool" }>,
    remainingChars: number,
  ): { message: OpenAIChatMessage; remainingChars: number } => {
    if (message.content.length <= remainingChars) {
      return {
        message,
        remainingChars: remainingChars - message.content.length,
      };
    }
    const content =
      remainingChars >= 1_000
        ? truncateMiddle(message.content, remainingChars)
        : this.buildOmittedHistoricalToolResult(message.content.length);
    return {
      message: { ...message, content },
      remainingChars: Math.max(0, remainingChars - content.length),
    };
  };

  private readonly normalizeStringResult = (
    result: string,
    context: ToolResultContentContext,
  ): NormalizeOutcome => {
    const redacted = this.redactString(result);
    if (redacted.length <= this.maxModelVisibleChars && redacted === result) {
      return { value: result, changed: false };
    }
    if (redacted.length <= this.maxModelVisibleChars) {
      return {
        value: this.buildStringNotice(context, result.length, redacted),
        changed: true,
      };
    }
    return {
      value: this.buildStringNotice(
        context,
        result.length,
        truncateMiddle(redacted, this.maxModelVisibleChars),
      ),
      changed: true,
    };
  };

  private readonly redactValue = (value: unknown, context: RedactContext): unknown => {
    if (typeof value === "string") {
      return this.redactString(value);
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    const imageSummary = this.imageService.summarizeImageContentItem(
      value as Record<string, unknown>,
    );
    if (imageSummary) {
      return imageSummary;
    }
    if (isBinaryLike(value)) {
      return `[omitted binary payload: bytes=${getBinaryByteLength(value)}]`;
    }
    if (context.depth >= this.maxDepth) {
      return `[omitted nested ${Array.isArray(value) ? "array" : "object"} beyond depth ${this.maxDepth}]`;
    }
    if (Array.isArray(value)) {
      return this.redactArray(value, context);
    }
    return this.redactObject(value as Record<string, unknown>, context);
  };

  private readonly redactArray = (value: unknown[], context: RedactContext): unknown[] => {
    const visibleItems = value
      .slice(0, this.maxArrayItems)
      .map((item) => this.redactValue(item, { depth: context.depth + 1 }));
    if (value.length <= this.maxArrayItems) {
      return visibleItems;
    }
    return [
      ...visibleItems,
      `[omitted ${value.length - this.maxArrayItems} array items from tool result]`,
    ];
  };

  private readonly redactObject = (
    value: Record<string, unknown>,
    context: RedactContext,
  ): Record<string, unknown> => {
    const entries = Object.entries(value);
    const visibleEntries = entries.slice(0, this.maxObjectKeys);
    const output = Object.fromEntries(
      visibleEntries.map(([key, item]) => [
        key,
        this.redactValue(item, { depth: context.depth + 1 }),
      ]),
    );
    if (entries.length > this.maxObjectKeys) {
      output._nextclawOmittedKeys = entries.length - this.maxObjectKeys;
    }
    return output;
  };

  private readonly redactString = (value: string): string => {
    if (isLargeDataUrl(value)) {
      return `[omitted data URL payload: mime=${readDataUrlMime(value)}, originalChars=${value.length}]`;
    }
    if (isLargeBase64LikeString(value)) {
      return `[omitted base64-like payload: originalChars=${value.length}]`;
    }
    if (value.length <= this.maxStringValueChars) {
      return value;
    }
    return truncateMiddle(value, this.maxStringValueChars);
  };

  private readonly attachNotice = (
    value: unknown,
    params: { context: ToolResultContentContext; originalSerializedChars: number },
  ): unknown => {
    const notice = this.buildNotice(params.context, params.originalSerializedChars);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return {
        ...(value as Record<string, unknown>),
        _nextclawToolResultNotice: notice,
      };
    }
    return {
      type: "nextclaw.tool_result_sanitized",
      notice,
      result: value,
    };
  };

  private readonly buildEnvelope = (params: {
    context: ToolResultContentContext;
    originalSerializedChars: number;
    previewSource: string;
  }): Record<string, unknown> => {
    const { context, originalSerializedChars, previewSource } = params;
    return {
      type: "nextclaw.tool_result_truncated",
      notice: this.buildNotice(context, originalSerializedChars),
      originalSerializedChars,
      visibleLimitChars: this.maxModelVisibleChars,
      preview: truncateMiddle(
        previewSource,
        Math.max(1_000, this.maxModelVisibleChars - 1_000),
      ),
    };
  };

  private readonly buildStringNotice = (
    context: ToolResultContentContext,
    originalChars: number,
    preview: string,
  ): string =>
    [
      TRUNCATION_MARKER,
      this.buildNotice(context, originalChars),
      "",
      preview,
    ].join("\n");

  private readonly buildNotice = (
    context: ToolResultContentContext,
    originalSerializedChars: number,
  ): string => {
    const { toolCallId: rawToolCallId, toolName: rawToolName } = context;
    const toolName = rawToolName ? ` tool=${rawToolName}` : "";
    const toolCallId = rawToolCallId ? ` toolCallId=${rawToolCallId}` : "";
    return `${TRUNCATION_MARKER}${toolName}${toolCallId} originalSerializedChars=${originalSerializedChars} visibleLimitChars=${this.maxModelVisibleChars}`;
  };

  private readonly buildOmittedHistoricalToolResult = (originalChars: number): string =>
    `${TRUNCATION_MARKER} older tool result omitted from active model context originalChars=${originalChars}`;

  private readonly boundModelContentText = (value: string): string => {
    if (value.length <= this.maxModelVisibleChars) {
      return value;
    }
    return truncateMiddle(value, this.maxModelVisibleChars);
  };
}

export const defaultToolResultContentManager = new ToolResultContentManager();
