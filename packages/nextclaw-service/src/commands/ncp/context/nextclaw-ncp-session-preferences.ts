import { parseThinkingLevel, type SessionManager, type ThinkingLevel } from "@nextclaw/core";

type SessionRecord = ReturnType<SessionManager["getOrCreate"]>;

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
  session: SessionRecord;
  requestMetadata: Record<string, unknown>;
  fallbackModel: string;
}): string {
  const clearModel =
    params.requestMetadata.clear_model === true ||
    params.requestMetadata.reset_model === true;
  if (clearModel) {
    delete params.session.metadata.preferred_model;
  }

  const inboundModel = readMetadataModel(params.requestMetadata);
  if (inboundModel) {
    params.session.metadata.preferred_model = inboundModel;
  }

  return normalizeOptionalString(params.session.metadata.preferred_model) ?? params.fallbackModel;
}

export function syncSessionThinkingPreference(params: {
  session: SessionRecord;
  requestMetadata: Record<string, unknown>;
}): void {
  const clearThinking =
    params.requestMetadata.clear_thinking === true ||
    params.requestMetadata.reset_thinking === true;
  if (clearThinking) {
    delete params.session.metadata.preferred_thinking;
  }

  const inboundThinking = readMetadataThinking(params.requestMetadata);
  if (inboundThinking === "__clear__") {
    delete params.session.metadata.preferred_thinking;
    return;
  }
  if (inboundThinking) {
    params.session.metadata.preferred_thinking = inboundThinking;
  }
}

export function resolveSessionChannelContext(params: {
  session: SessionRecord;
  requestMetadata: Record<string, unknown>;
}): { channel: string; chatId: string } {
  const channel =
    normalizeOptionalString(params.requestMetadata.channel) ??
    normalizeOptionalString(params.session.metadata.last_channel) ??
    "ui";
  const chatId =
    normalizeOptionalString(params.requestMetadata.chatId) ??
    normalizeOptionalString(params.requestMetadata.chat_id) ??
    normalizeOptionalString(params.session.metadata.last_to) ??
    "web-ui";

  params.session.metadata.last_channel = channel;
  params.session.metadata.last_to = chatId;
  return { channel, chatId };
}
