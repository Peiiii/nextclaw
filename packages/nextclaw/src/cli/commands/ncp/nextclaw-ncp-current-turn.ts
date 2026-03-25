import type { NcpAgentRunInput, NcpMessage, NcpMessagePart } from "@nextclaw/ncp";
import {
  buildLegacyUserContent,
  ensureIsoTimestamp,
  extractTextFromNcpMessage,
} from "./nextclaw-ncp-message-bridge.js";

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
  const nextParts = structuredClone(params.parts);
  const firstTextIndex = params.textPartIndexes[0];
  const lastTextIndex = params.textPartIndexes[params.textPartIndexes.length - 1];

  for (const index of params.textPartIndexes) {
    const part = nextParts[index];
    if (!part || !isTextLikePart(part)) {
      continue;
    }
    if (index === firstTextIndex) {
      part.text = `${params.prefix}${part.text}`;
    }
    if (index === lastTextIndex) {
      part.text = `${part.text}${params.suffix}`;
    }
  }

  return nextParts;
}

function buildFormattedCurrentParts(params: {
  message: NcpMessage | undefined;
  formattedText: string;
  originalText: string;
}): NcpMessagePart[] {
  const parts = params.message?.parts ?? [];
  if (parts.length === 0) {
    return params.formattedText.length > 0 ? [{ type: "text", text: params.formattedText }] : [];
  }

  const textPartIndexes = collectTextPartIndexes(parts);
  if (textPartIndexes.length === 0) {
    return params.formattedText.length > 0
      ? [{ type: "text", text: params.formattedText }, ...structuredClone(parts)]
      : structuredClone(parts);
  }

  if (params.formattedText === params.originalText) {
    return structuredClone(parts);
  }

  const originalTextIndex = params.formattedText.indexOf(params.originalText);
  if (params.originalText.length === 0 || originalTextIndex < 0) {
    return replaceTextPartsWithSingleFormattedText(parts, textPartIndexes, params.formattedText);
  }

  return wrapTextPartsWithFormattedEdges({
    parts,
    textPartIndexes,
    prefix: params.formattedText.slice(0, originalTextIndex),
    suffix: params.formattedText.slice(originalTextIndex + params.originalText.length),
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
}): {
  currentUserContent: unknown;
  effectiveModel: string;
} {
  const latestUserMessage = findLatestUserMessage(params.input);
  const originalText = extractTextFromNcpMessage(latestUserMessage);
  const formattedText = params.formatPrompt({
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
    currentUserContent: buildLegacyUserContent(currentParts),
    effectiveModel: params.currentModel,
  };
}
