import type { NcpAgentRunInput, NcpMessage, NcpMessagePart } from "@nextclaw/ncp";
import type { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import {
  buildLegacyUserContent,
  ensureIsoTimestamp,
  extractTextFromNcpMessage,
} from "@kernel/utils/ncp-message-bridge.utils.js";

function isTextLikePart(part: NcpMessagePart): part is Extract<NcpMessagePart, { type: "text" | "rich-text" }> {
  return part.type === "text" || part.type === "rich-text";
}

function collectTextPartIndexes(parts: NcpMessagePart[]): number[] {
  return parts
    .map((part, index) => (isTextLikePart(part) ? index : -1))
    .filter((index) => index >= 0);
}

function replaceTextPartsWithSingleFormattedText(
  parts: NcpMessagePart[],
  textPartIndexes: number[],
  formattedText: string,
): NcpMessagePart[] {
  const nextParts = structuredClone(parts);
  const firstTextIndex = textPartIndexes[0];
  const firstTextPart = nextParts[firstTextIndex];
  if (firstTextPart && isTextLikePart(firstTextPart)) {
    firstTextPart.text = formattedText;
  }

  return nextParts.filter((part, index) => {
    if (!isTextLikePart(part)) {
      return true;
    }
    return index === firstTextIndex && part.text.length > 0;
  });
}

function wrapTextPartsWithFormattedEdges(params: {
  parts: NcpMessagePart[];
  textPartIndexes: number[];
  prefix: string;
  suffix: string;
}): NcpMessagePart[] {
  const { parts, prefix, suffix, textPartIndexes } = params;
  const nextParts = structuredClone(parts);
  const firstTextIndex = textPartIndexes[0];
  const lastTextIndex = textPartIndexes[textPartIndexes.length - 1];

  for (const index of textPartIndexes) {
    const part = nextParts[index];
    if (!part || !isTextLikePart(part)) {
      continue;
    }
    if (index === firstTextIndex) {
      part.text = `${prefix}${part.text}`;
    }
    if (index === lastTextIndex) {
      part.text = `${part.text}${suffix}`;
    }
  }

  return nextParts;
}

function buildFormattedCurrentParts(params: {
  message: NcpMessage | undefined;
  formattedText: string;
  originalText: string;
}): NcpMessagePart[] {
  const { formattedText, message, originalText } = params;
  const parts = message?.parts ?? [];
  if (parts.length === 0) {
    return formattedText.length > 0 ? [{ type: "text", text: formattedText }] : [];
  }

  const textPartIndexes = collectTextPartIndexes(parts);
  if (textPartIndexes.length === 0) {
    return formattedText.length > 0
      ? [{ type: "text", text: formattedText }, ...structuredClone(parts)]
      : structuredClone(parts);
  }

  if (formattedText === originalText) {
    return structuredClone(parts);
  }

  const originalTextIndex = formattedText.indexOf(originalText);
  if (originalText.length === 0 || originalTextIndex < 0) {
    return replaceTextPartsWithSingleFormattedText(parts, textPartIndexes, formattedText);
  }

  return wrapTextPartsWithFormattedEdges({
    parts,
    textPartIndexes,
    prefix: formattedText.slice(0, originalTextIndex),
    suffix: formattedText.slice(originalTextIndex + originalText.length),
  });
}

export function findLatestUserMessage(input: NcpAgentRunInput): NcpMessage | undefined {
  return (
    input.messages
      .slice()
      .reverse()
      .find((message) => message.role === "user") ??
    input.messages[input.messages.length - 1]
  );
}

export function buildCurrentTurnState(params: {
  input: NcpAgentRunInput;
  currentModel: string;
  formatPrompt: (params: { text: string; timestamp: Date }) => string;
  assetStore?: LocalAssetStore | null;
}): {
  currentRole: "user" | "system";
  currentUserContent: unknown;
  effectiveModel: string;
} {
  const { assetStore, currentModel, formatPrompt, input } = params;
  const latestUserMessage = findLatestUserMessage(input);
  const originalText = extractTextFromNcpMessage(latestUserMessage);
  const formattedText = formatPrompt({
    text: originalText,
    timestamp: new Date(
      ensureIsoTimestamp(
        latestUserMessage?.timestamp,
        new Date().toISOString(),
      ),
    ),
  });
  const currentParts = buildFormattedCurrentParts({
    message: latestUserMessage,
    formattedText,
    originalText,
  });

  return {
    currentRole: latestUserMessage?.role === "system" ? "system" : "user",
    currentUserContent: buildLegacyUserContent(currentParts, {
      assetStore,
    }),
    effectiveModel: currentModel,
  };
}
