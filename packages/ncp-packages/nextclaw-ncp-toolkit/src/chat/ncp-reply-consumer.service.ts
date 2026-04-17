import {
  NcpEventType,
  sanitizeAssistantReplyTags,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpMessagePart,
  type NcpRichTextPart,
  type NcpTextPart,
} from "@nextclaw/ncp";
import type { Chat, ChatTarget, NcpEventStream, NcpReplyInput } from "./chat.types.js";

function isTextLikePart(
  part: NcpMessagePart,
): part is Extract<NcpMessagePart, { type: "text" | "rich-text" }> {
  return part.type === "text" || part.type === "rich-text";
}

function normalizeMessageParts(message: NcpMessage): NcpMessagePart[] {
  const normalizedMessage =
    message.role === "assistant" ? sanitizeAssistantReplyTags(message) : message;
  return normalizedMessage.parts;
}

function cloneTextLikePartTail(
  part: Extract<NcpMessagePart, { type: "text" | "rich-text" }>,
  skipChars: number,
): NcpTextPart | NcpRichTextPart | null {
  const nextText = part.text.slice(skipChars);
  if (!nextText) {
    return null;
  }
  if (part.type === "text") {
    return {
      type: "text",
      text: nextText,
    };
  }
  return {
    ...part,
    text: nextText,
  };
}

function resolveFallbackUnsentParts(
  fallbackText: string,
  sentText: string,
): NcpMessagePart[] {
  if (!fallbackText) {
    return [];
  }
  if (!sentText) {
    return [{ type: "text", text: fallbackText }];
  }
  if (fallbackText === sentText) {
    return [];
  }
  if (fallbackText.startsWith(sentText)) {
    return [{ type: "text", text: fallbackText.slice(sentText.length) }];
  }
  return [{ type: "text", text: fallbackText }];
}

function canReuseCompletedTextPrefix(
  normalizedParts: NcpMessagePart[],
  sentText: string,
): boolean {
  const finalText = normalizedParts
    .filter(isTextLikePart)
    .map((part) => part.text)
    .join("");
  return !(sentText && finalText && !finalText.startsWith(sentText));
}

function collectUnsentPartsFromNormalizedParts(
  normalizedParts: NcpMessagePart[],
  sentText: string,
): NcpMessagePart[] {
  let remainingSentChars = sentText.length;
  const unsentParts: NcpMessagePart[] = [];

  for (const part of normalizedParts) {
    if (!isTextLikePart(part)) {
      unsentParts.push(part);
      continue;
    }
    if (remainingSentChars >= part.text.length) {
      remainingSentChars -= part.text.length;
      continue;
    }
    if (remainingSentChars > 0) {
      const tail = cloneTextLikePartTail(part, remainingSentChars);
      remainingSentChars = 0;
      if (tail) {
        unsentParts.push(tail);
      }
      continue;
    }
    unsentParts.push(part);
  }

  return unsentParts;
}

function resolveUnsentMessageParts(
  message: NcpMessage,
  sentText: string,
  fallbackText: string,
): NcpMessagePart[] {
  const normalizedParts = normalizeMessageParts(message);
  if (normalizedParts.length === 0) {
    return resolveFallbackUnsentParts(fallbackText, sentText);
  }
  if (!canReuseCompletedTextPrefix(normalizedParts, sentText)) {
    return normalizedParts;
  }
  return collectUnsentPartsFromNormalizedParts(normalizedParts, sentText);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function projectAssetPutFiles(
  result: unknown,
): Extract<NcpMessagePart, { type: "file" }>[] {
  if (!isRecord(result)) {
    return [];
  }

  const assetCandidates = isRecord(result.asset)
    ? [result.asset]
    : Array.isArray(result.assets)
      ? result.assets.filter(isRecord)
      : [];

  return assetCandidates.flatMap((asset) => {
    const assetUri = readOptionalString(asset.uri);
    const url = readOptionalString(asset.url);
    if (!assetUri && !url) {
      return [];
    }
    return [
      {
        type: "file" as const,
        ...(readOptionalString(asset.name)
          ? { name: readOptionalString(asset.name) }
          : {}),
        ...(readOptionalString(asset.mimeType)
          ? { mimeType: readOptionalString(asset.mimeType) }
          : {}),
        ...(assetUri ? { assetUri } : {}),
        ...(url ? { url } : {}),
        ...(readOptionalNumber(asset.sizeBytes) != null
          ? { sizeBytes: readOptionalNumber(asset.sizeBytes) }
          : {}),
      },
    ];
  });
}

function projectToolResultParts(params: {
  toolCallId?: string;
  toolName?: string;
  content: unknown;
  projectedToolCallIds: Set<string>;
}): NcpMessagePart[] {
  if (
    params.toolName !== "asset_put" ||
    !params.toolCallId ||
    params.projectedToolCallIds.has(params.toolCallId)
  ) {
    return [];
  }
  const projectedFiles = projectAssetPutFiles(params.content);
  if (projectedFiles.length > 0) {
    params.projectedToolCallIds.add(params.toolCallId);
  }
  return projectedFiles;
}

function projectChannelOutputParts(
  parts: NcpMessagePart[],
  projectedToolCallIds: Set<string>,
): NcpMessagePart[] {
  return parts.flatMap((part) => {
    if (
      part.type === "tool-invocation" &&
      part.toolName === "asset_put" &&
      part.result
    ) {
      if (
        part.toolCallId &&
        projectedToolCallIds.has(part.toolCallId)
      ) {
        return [];
      }
      const projectedFiles = projectAssetPutFiles(part.result);
      if (projectedFiles.length > 0) {
        if (part.toolCallId) {
          projectedToolCallIds.add(part.toolCallId);
        }
        return projectedFiles;
      }
    }
    return [part];
  });
}

class NcpReplySession {
  private activeText = "";
  private fullText = "";
  private sentText = "";
  private typingStarted = false;
  private closed = false;
  private readonly toolNameByCallId = new Map<string, string>();
  private readonly projectedToolCallIds = new Set<string>();

  constructor(
    private readonly chat: Chat,
    private readonly target: ChatTarget,
  ) {}

  consume = async (eventStream: NcpEventStream): Promise<void> => {
    try {
      for await (const event of eventStream) {
        if (this.closed) {
          break;
        }
        await this.applyEvent(event);
      }
    } finally {
      await this.stopTyping();
    }
  };

  private applyEvent = async (event: NcpEndpointEvent): Promise<void> => {
    switch (event.type) {
      case NcpEventType.MessageTextStart:
        await this.handleTextStart();
        return;
      case NcpEventType.MessageTextDelta:
        await this.handleTextDelta(event.payload.delta);
        return;
      case NcpEventType.MessageTextEnd:
        await this.handleTextEnd();
        return;
      case NcpEventType.MessageToolCallStart:
        await this.handleToolCallStart(
          event.payload.toolCallId,
          event.payload.toolName,
        );
        return;
      case NcpEventType.MessageReasoningStart:
        await this.flushTextPart();
        return;
      case NcpEventType.MessageToolCallResult:
        await this.handleToolCallResult(
          event.payload.toolCallId,
          event.payload.content,
        );
        return;
      case NcpEventType.MessageCompleted:
        await this.handleCompleted(event.payload.message);
        return;
      case NcpEventType.MessageFailed:
        await this.handleReplyFailure(event.payload.error.message.trim());
        return;
      case NcpEventType.RunError:
        await this.handleReplyFailure(
          String(event.payload.error ?? "NCP run failed.").trim(),
        );
        return;
      default:
        return;
    }
  };

  private handleTextStart = async (): Promise<void> => {
    await this.ensureTypingStarted();
    if (this.activeText) {
      await this.flushTextPart();
    }
    this.activeText = "";
  };

  private handleTextDelta = async (delta: string): Promise<void> => {
    await this.ensureTypingStarted();
    this.activeText += delta;
    this.fullText += delta;
  };

  private handleTextEnd = async (): Promise<void> => {
    await this.flushTextPart();
  };

  private handleToolCallStart = async (
    toolCallId: string,
    toolName: string,
  ): Promise<void> => {
    this.toolNameByCallId.set(toolCallId, toolName);
    await this.ensureTypingStarted();
    await this.flushTextPart();
  };

  private handleToolCallResult = async (
    toolCallId: string,
    content: unknown,
  ): Promise<void> => {
    await this.ensureTypingStarted();
    const projectedParts = projectToolResultParts({
      toolCallId,
      toolName: this.toolNameByCallId.get(toolCallId),
      content,
      projectedToolCallIds: this.projectedToolCallIds,
    });
    if (projectedParts.length === 0) {
      return;
    }
    await this.flushTextPart();
    for (const part of projectedParts) {
      await this.chat.sendPart(this.target, part);
    }
  };

  private handleCompleted = async (message: NcpMessage): Promise<void> => {
    await this.flushTextPart();
    const unsentParts = projectChannelOutputParts(
      resolveUnsentMessageParts(message, this.sentText, this.fullText),
      this.projectedToolCallIds,
    );
    for (const part of unsentParts) {
      await this.ensureTypingStarted();
      await this.chat.sendPart(this.target, part);
      if (isTextLikePart(part)) {
        this.sentText += part.text;
      }
    }
    await this.stopTyping();
  };

  private handleReplyFailure = async (message: string): Promise<void> => {
    if (message) {
      await this.ensureTypingStarted();
      await this.chat.sendError(this.target, message);
    }
    await this.stopTyping();
  };

  private flushTextPart = async (): Promise<void> => {
    if (!this.activeText.trim()) {
      this.activeText = "";
      return;
    }

    await this.ensureTypingStarted();
    await this.chat.sendPart(this.target, {
      type: "text",
      text: this.activeText,
    });
    this.sentText += this.activeText;
    this.activeText = "";
  };

  private ensureTypingStarted = async (): Promise<void> => {
    if (this.typingStarted) {
      return;
    }
    await this.chat.startTyping(this.target);
    this.typingStarted = true;
  };

  private stopTyping = async (): Promise<void> => {
    if (this.closed || !this.typingStarted) {
      return;
    }
    await this.chat.stopTyping(this.target);
    this.closed = true;
  };
};

export class NcpReplyConsumer {
  constructor(private readonly chat: Chat) {}

  consume = async (input: NcpReplyInput): Promise<void> => {
    const session = new NcpReplySession(this.chat, input.target);
    await session.consume(input.eventStream);
  };
}
