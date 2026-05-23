import { parseThinkingLevel, type ThinkingLevel } from "@nextclaw/core";

export function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readMetadataModel(metadata: Record<string, unknown>): string | null {
  const candidates = [metadata.model, metadata.llm_model, metadata.agent_model, metadata.session_model];
  for (const candidate of candidates) {
    const normalized = normalizeOptionalString(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

export function readMetadataThinking(metadata: Record<string, unknown>): ThinkingLevel | "__clear__" | null {
  const candidates = [
    metadata.thinking,
    metadata.thinking_level,
    metadata.thinkingLevel,
    metadata.thinking_effort,
    metadata.thinkingEffort,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const normalized = candidate.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    if (normalized === "clear" || normalized === "reset" || normalized === "off!") {
      return "__clear__";
    }
    const level = parseThinkingLevel(normalized);
    if (level) {
      return level;
    }
  }
  return null;
}

export function resolveEffectiveModel(params: {
  sessionMetadata: Record<string, unknown>;
  requestMetadata: Record<string, unknown>;
  fallbackModel: string;
}): { metadata: Record<string, unknown>; model: string } {
  const { fallbackModel, requestMetadata } = params;
  const metadata = structuredClone(params.sessionMetadata);
  const clearModel =
    requestMetadata.clear_model === true ||
    requestMetadata.reset_model === true;
  if (clearModel) {
    delete metadata.preferred_model;
  }

  const inboundModel = readMetadataModel(requestMetadata);
  if (inboundModel) {
    metadata.preferred_model = inboundModel;
  }

  return {
    metadata,
    model: normalizeOptionalString(metadata.preferred_model) ?? fallbackModel,
  };
}

export function syncSessionThinkingPreference(params: {
  sessionMetadata: Record<string, unknown>;
  requestMetadata: Record<string, unknown>;
}): Record<string, unknown> {
  const { requestMetadata } = params;
  const metadata = structuredClone(params.sessionMetadata);
  const clearThinking =
    requestMetadata.clear_thinking === true ||
    requestMetadata.reset_thinking === true;
  if (clearThinking) {
    delete metadata.preferred_thinking;
  }

  const inboundThinking = readMetadataThinking(requestMetadata);
  if (inboundThinking === "__clear__") {
    delete metadata.preferred_thinking;
    return metadata;
  }
  if (inboundThinking) {
    metadata.preferred_thinking = inboundThinking;
  }
  return metadata;
}

export function resolveSessionChannelContext(params: {
  sessionMetadata: Record<string, unknown>;
  requestMetadata: Record<string, unknown>;
}): { channel: string; chatId: string; metadata: Record<string, unknown> } {
  const { requestMetadata } = params;
  const metadata = structuredClone(params.sessionMetadata);
  const channel =
    normalizeOptionalString(requestMetadata.channel) ??
    normalizeOptionalString(metadata.last_channel) ??
    "ui";
  const chatId =
    normalizeOptionalString(requestMetadata.chatId) ??
    normalizeOptionalString(requestMetadata.chat_id) ??
    normalizeOptionalString(metadata.last_to) ??
    "web-ui";

  metadata.last_channel = channel;
  metadata.last_to = chatId;
  return { channel, chatId, metadata };
}
