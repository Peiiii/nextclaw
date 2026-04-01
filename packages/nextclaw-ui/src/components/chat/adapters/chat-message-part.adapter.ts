import {
  stringifyUnknown,
  summarizeToolArgs,
  type ToolCard,
} from "@/lib/chat-message";
import {
  type ChatInlineTokenSource,
} from "@/components/chat/chat-inline-token.utils";
import {
  buildRenderableText,
  buildTextPart,
} from "@/components/chat/adapters/chat-message-inline-content.adapter";
import { buildFileOperationCardData } from "@/components/chat/adapters/chat-message.file-operation-card";
import { buildSubagentToolCard } from "@/components/chat/adapters/chat-message.subagent-tool-card";
import type {
  ChatMessagePartViewModel,
  ChatToolPartViewModel,
} from "@nextclaw/agent-chat-ui";

export type ChatMessageAdapterTexts = {
  roleLabels: {
    user: string;
    assistant: string;
    tool: string;
    system: string;
    fallback: string;
  };
  reasoningLabel: string;
  toolCallLabel: string;
  toolResultLabel: string;
  toolInputLabel: string;
  toolNoOutputLabel: string;
  toolOutputLabel: string;
  toolStatusPreparingLabel: string;
  toolStatusRunningLabel: string;
  toolStatusCompletedLabel: string;
  toolStatusFailedLabel: string;
  toolStatusCancelledLabel: string;
  imageAttachmentLabel: string;
  fileAttachmentLabel: string;
  unknownPartLabel: string;
};

export type ChatMessagePartSource =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "file";
      mimeType: string;
      data: string;
      url?: string;
      name?: string;
      sizeBytes?: number;
    }
  | {
      type: "reasoning";
      reasoning: string;
    }
  | {
      type: "tool-invocation";
      toolInvocation: {
        status?: string;
        toolName: string;
        args?: unknown;
        parsedArgs?: unknown;
        result?: unknown;
        error?: string;
        cancelled?: boolean;
        toolCallId?: string;
      };
    }
  | {
      type: string;
      [key: string]: unknown;
    };

type ToolCardViewSource = ToolCard & {
  statusTone: ChatToolPartViewModel["statusTone"];
  statusLabel: string;
  fileOperation?: ChatToolPartViewModel["fileOperation"];
  outputData?: unknown;
};

type ChatMessagePartAdapterParams = {
  part: ChatMessagePartSource;
  inlineTokens: readonly ChatInlineTokenSource[];
  texts: ChatMessageAdapterTexts;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isTerminalResultRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  return (
    "command" in value ||
    "workingDir" in value ||
    "exitCode" in value ||
    "stdout" in value ||
    "stderr" in value ||
    "aggregated_output" in value ||
    "combinedOutput" in value
  );
}

function extractAssetFileView(
  value: unknown,
  texts: ChatMessageAdapterTexts,
): Extract<ChatMessagePartViewModel, { type: "file" }> | null {
  if (!isRecord(value)) {
    return null;
  }
  const assetCandidate = isRecord(value.asset)
    ? value.asset
    : Array.isArray(value.assets) &&
        value.assets.length > 0 &&
        isRecord(value.assets[0])
      ? value.assets[0]
      : null;
  if (!assetCandidate) {
    return null;
  }
  const url = readOptionalString(assetCandidate.url);
  const mimeType =
    readOptionalString(assetCandidate.mimeType) ?? "application/octet-stream";
  const sizeBytes = readOptionalNumber(assetCandidate.sizeBytes);
  if (!url) {
    return null;
  }
  const label =
    readOptionalString(assetCandidate.name) ??
    (mimeType.startsWith("image/")
      ? texts.imageAttachmentLabel
      : texts.fileAttachmentLabel);
  return {
    type: "file",
    file: {
      label,
      mimeType,
      dataUrl: url,
      ...(sizeBytes != null ? { sizeBytes } : {}),
      isImage: mimeType.startsWith("image/"),
    },
  };
}

function buildToolCard(
  toolCard: ToolCardViewSource,
  texts: ChatMessageAdapterTexts,
): ChatToolPartViewModel {
  return {
    kind: toolCard.kind,
    toolName: toolCard.name,
    summary: toolCard.detail,
    inputLabel: texts.toolInputLabel,
    input: "input" in toolCard && typeof toolCard.input === "string"
      ? toolCard.input
      : undefined,
    output: toolCard.text,
    outputData: toolCard.outputData,
    hasResult: Boolean(toolCard.hasResult),
    statusTone: toolCard.statusTone,
    statusLabel: toolCard.statusLabel,
    titleLabel:
      toolCard.kind === "call" ? texts.toolCallLabel : texts.toolResultLabel,
    outputLabel: texts.toolOutputLabel,
    emptyLabel: texts.toolNoOutputLabel,
    ...("fileOperation" in toolCard && toolCard.fileOperation
      ? { fileOperation: toolCard.fileOperation }
      : {}),
  };
}

function resolveToolCardStatus(params: {
  status?: string;
  error?: string;
  cancelled?: boolean;
  result?: unknown;
  texts: ChatMessageAdapterTexts;
}): Pick<
  ChatToolPartViewModel,
  "kind" | "hasResult" | "statusTone" | "statusLabel"
> {
  const rawStatus =
    typeof params.status === "string" ? params.status.trim().toLowerCase() : "";
  const hasError =
    typeof params.error === "string" && params.error.trim().length > 0;
  const isCancelled = params.cancelled === true || rawStatus === "cancelled";
  if (isCancelled) {
    return {
      kind: "result",
      hasResult: true,
      statusTone: "cancelled",
      statusLabel: params.texts.toolStatusCancelledLabel,
    };
  }
  if (hasError || rawStatus === "error") {
    return {
      kind: "result",
      hasResult: true,
      statusTone: "error",
      statusLabel: params.texts.toolStatusFailedLabel,
    };
  }
  if (rawStatus === "result" || params.result != null) {
    return {
      kind: "result",
      hasResult: true,
      statusTone: "success",
      statusLabel: params.texts.toolStatusCompletedLabel,
    };
  }
  if (rawStatus === "partial-call") {
    return {
      kind: "call",
      hasResult: false,
      statusTone: "running",
      statusLabel: params.texts.toolStatusRunningLabel,
    };
  }
  return {
    kind: "call",
    hasResult: false,
    statusTone: "running",
    statusLabel: params.texts.toolStatusRunningLabel,
  };
}

function parseStructuredValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function buildToolInvocationInput(args?: unknown, parsedArgs?: unknown): string | undefined {
  const source = parsedArgs ?? parseStructuredValue(args);
  const text = stringifyUnknown(source).trim();
  return text || undefined;
}

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

  const subagentToolCard = buildSubagentToolCard({
    invocation,
    texts,
  });
  if (subagentToolCard) {
    return {
      type: "tool-card",
      card: buildToolCard(subagentToolCard, texts),
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
  const card: ToolCardViewSource = {
    kind: statusView.kind,
    name: invocation.toolName,
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
  if (!isRecord(part.toolInvocation)) {
    return false;
  }
  return typeof part.toolInvocation.toolName === "string";
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
