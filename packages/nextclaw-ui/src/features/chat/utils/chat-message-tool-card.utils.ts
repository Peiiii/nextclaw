import {
  stringifyUnknown,
  type ToolCard,
} from "@/features/chat/utils/chat-message-core.utils";
import type {
  ChatMessagePartViewModel,
  ChatToolPartViewModel,
} from "@nextclaw/agent-chat-ui";
import type { ChatMessageAdapterTexts } from "@/features/chat/types/chat-message.types";

export type ToolCardViewSource = ToolCard & {
  statusTone: ChatToolPartViewModel["statusTone"];
  statusLabel: string;
  agentId?: string;
  action?: ChatToolPartViewModel["action"];
  fileOperation?: ChatToolPartViewModel["fileOperation"];
  outputData?: unknown;
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

export function readOptionalNumber(value: unknown): number | null {
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

export function isTerminalResultRecord(
  value: unknown,
): value is Record<string, unknown> {
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

export function extractAssetFileView(
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

export function buildToolCard(
  toolCard: ToolCardViewSource,
  texts: ChatMessageAdapterTexts,
): ChatToolPartViewModel {
  return {
    kind: toolCard.kind,
    toolName: toolCard.name,
    ...("agentId" in toolCard && toolCard.agentId
      ? { agentId: toolCard.agentId }
      : {}),
    summary: toolCard.detail,
    inputLabel: texts.toolInputLabel,
    input:
      "input" in toolCard && typeof toolCard.input === "string"
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
    ...("action" in toolCard && toolCard.action
      ? { action: toolCard.action }
      : {}),
    ...("fileOperation" in toolCard && toolCard.fileOperation
      ? { fileOperation: toolCard.fileOperation }
      : {}),
  };
}

export function resolveToolCardStatus(params: {
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

export function buildToolInvocationInput(
  args?: unknown,
  parsedArgs?: unknown,
): string | undefined {
  const source = parsedArgs ?? parseStructuredValue(args);
  const text = stringifyUnknown(source).trim();
  return text || undefined;
}
