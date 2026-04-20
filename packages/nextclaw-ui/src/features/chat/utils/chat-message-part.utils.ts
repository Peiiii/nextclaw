import {
  stringifyUnknown,
  summarizeToolArgs,
} from "@/lib/chat-message";
import { type ChatInlineTokenSource } from "@/features/chat/utils/chat-inline-token.utils";
import {
  buildRenderableText,
  buildTextPart,
} from "./chat-message-inline-content.utils";
import {
  buildToolCard,
  buildToolInvocationInput,
  extractAssetFileView,
  isTerminalResultRecord,
  readOptionalNumber,
  resolveToolCardStatus,
  type ToolCardViewSource,
} from "./chat-message-tool-card.utils";
import { resolveToolInvocationAgentId } from "./chat-message-tool-agent-id.utils";
import { buildFileOperationCardData } from "./file-operation/card.utils";
import { buildSessionRequestToolCard } from "./chat-message-session-request-tool-card.utils";
import type {
  ChatMessagePartViewModel,
  ChatToolPartViewModel,
} from "@nextclaw/agent-chat-ui";
import type {
  ChatMessageAdapterTexts,
  ChatMessagePartSource,
} from "@/features/chat/types/chat-message.types";

export type {
  ChatMessageAdapterTexts,
  ChatMessagePartSource,
} from "@/features/chat/types/chat-message.types";

type ChatMessagePartAdapterParams = {
  part: ChatMessagePartSource;
  inlineTokens: readonly ChatInlineTokenSource[];
  texts: ChatMessageAdapterTexts;
};


function buildReasoningPart(
  part: Extract<ChatMessagePartSource, { type: "reasoning" }>,
  texts: ChatMessageAdapterTexts,
): Extract<ChatMessagePartViewModel, { type: "reasoning" }> | null {
  const text = buildRenderableText(part.reasoning);
  if (!text) {
    return null;
  }
  return {
    type: "reasoning",
    text,
    label: texts.reasoningLabel,
  };
}

function buildFilePart(
  part: Extract<ChatMessagePartSource, { type: "file" }>,
  texts: ChatMessageAdapterTexts,
): Extract<ChatMessagePartViewModel, { type: "file" }> {
  const isImage = part.mimeType.startsWith("image/");
  const sizeBytes = readOptionalNumber(part.sizeBytes);
  return {
    type: "file",
    file: {
      label:
        typeof part.name === "string" && part.name.trim()
          ? part.name.trim()
          : isImage
            ? texts.imageAttachmentLabel
            : texts.fileAttachmentLabel,
      mimeType: part.mimeType,
      dataUrl:
        typeof part.url === "string" && part.url.trim().length > 0
          ? part.url.trim()
          : `data:${part.mimeType};base64,${part.data}`,
      ...(sizeBytes != null ? { sizeBytes } : {}),
      isImage,
    },
  };
}

function buildToolInvocationPart(
  part: Extract<ChatMessagePartSource, { type: "tool-invocation" }>,
  texts: ChatMessageAdapterTexts,
): Extract<ChatMessagePartViewModel, { type: "tool-card" | "file" }> {
  const invocation = part.toolInvocation;
  const assetFileView = extractAssetFileView(invocation.result, texts);
  if (assetFileView) {
    return assetFileView;
  }

  const sessionRequestToolCard = buildSessionRequestToolCard({
    invocation,
    texts: {
      toolStatusRunningLabel: texts.toolStatusRunningLabel,
      toolStatusCompletedLabel: texts.toolStatusCompletedLabel,
      toolStatusFailedLabel: texts.toolStatusFailedLabel,
    },
  });
  if (sessionRequestToolCard) {
    return {
      type: "tool-card",
      card: buildToolCard(sessionRequestToolCard, texts),
    };
  }

  const statusView = resolveToolCardStatus({
    status: invocation.status,
    error: invocation.error,
    cancelled: invocation.cancelled,
    result: invocation.result,
    texts,
  });
  const fileOperationCardData = buildFileOperationCardData({
    toolName: invocation.toolName,
    status: invocation.status,
    toolCallId: invocation.toolCallId,
    args: invocation.args,
    parsedArgs: invocation.parsedArgs,
    result: invocation.result,
  });
  const detail =
    fileOperationCardData?.summary ??
    summarizeToolArgs(invocation.parsedArgs ?? invocation.args);
  const input = fileOperationCardData
    ? undefined
    : buildToolInvocationInput(invocation.args, invocation.parsedArgs);
  const rawResult =
    typeof invocation.error === "string" && invocation.error.trim()
      ? invocation.error.trim()
      : invocation.result != null
        ? stringifyUnknown(invocation.result).trim()
        : "";
  const shouldHideStructuredTerminalJson =
    !invocation.error && isTerminalResultRecord(invocation.result);
  const shouldShowRawResult =
    (!fileOperationCardData?.fileOperation || Boolean(invocation.error)) &&
    !shouldHideStructuredTerminalJson;
  const agentId = resolveToolInvocationAgentId(invocation);
  const card: ToolCardViewSource = {
    kind: statusView.kind,
    name: invocation.toolName,
    ...(agentId ? { agentId } : {}),
    detail,
    ...(input ? { input } : {}),
    text: shouldShowRawResult && rawResult ? rawResult : undefined,
    outputData: invocation.result,
    callId: invocation.toolCallId || undefined,
    hasResult: statusView.hasResult,
    statusTone: statusView.statusTone,
    statusLabel: statusView.statusLabel,
    ...(fileOperationCardData?.fileOperation
      ? { fileOperation: fileOperationCardData.fileOperation }
      : {}),
  };
  return {
    type: "tool-card",
    card: buildToolCard(card, texts),
  };
}

function buildUnknownPart(
  part: ChatMessagePartSource,
  texts: ChatMessageAdapterTexts,
): Extract<ChatMessagePartViewModel, { type: "unknown" }> {
  return {
    type: "unknown",
    label: texts.unknownPartLabel,
    rawType: typeof part.type === "string" ? part.type : "unknown",
    text: stringifyUnknown(part),
  };
}

function isTextPart(
  part: ChatMessagePartSource,
): part is Extract<ChatMessagePartSource, { type: "text" }> {
  return part.type === "text" && typeof part.text === "string";
}

function isReasoningPart(
  part: ChatMessagePartSource,
): part is Extract<ChatMessagePartSource, { type: "reasoning" }> {
  return part.type === "reasoning" && typeof part.reasoning === "string";
}

function isFilePart(
  part: ChatMessagePartSource,
): part is Extract<ChatMessagePartSource, { type: "file" }> {
  return (
    part.type === "file" &&
    typeof part.mimeType === "string" &&
    typeof part.data === "string"
  );
}

function isToolInvocationPart(
  part: ChatMessagePartSource,
): part is Extract<ChatMessagePartSource, { type: "tool-invocation" }> {
  if (part.type !== "tool-invocation") {
    return false;
  }
  if (
    typeof part.toolInvocation !== "object" ||
    part.toolInvocation === null ||
    Array.isArray(part.toolInvocation)
  ) {
    return false;
  }
  return (
    "toolName" in part.toolInvocation &&
    typeof part.toolInvocation.toolName === "string"
  );
}

export function adaptChatMessagePart(
  params: ChatMessagePartAdapterParams,
): ChatMessagePartViewModel | null {
  if (isTextPart(params.part)) {
    return buildTextPart(params.part, params.inlineTokens);
  }
  if (isReasoningPart(params.part)) {
    return buildReasoningPart(params.part, params.texts);
  }
  if (isFilePart(params.part)) {
    return buildFilePart(params.part, params.texts);
  }
  if (isToolInvocationPart(params.part)) {
    return buildToolInvocationPart(params.part, params.texts);
  }
  return buildUnknownPart(params.part, params.texts);
}
