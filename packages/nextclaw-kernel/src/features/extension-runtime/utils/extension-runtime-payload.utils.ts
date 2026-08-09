import type {
  ExtensionChannelAuthLoginResult,
  ExtensionChannelAuthPollResult,
  InboundAttachment,
  InboundMessage,
} from "@nextclaw/core";

export function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function readRequiredString(value: unknown, name: string): string {
  const trimmed = readString(value);
  if (!trimmed) {
    throw new Error(`${name} is required`);
  }
  return trimmed;
}

export function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readTextContent(value: unknown): string {
  const content = readRecord(value);
  if (content.type !== "text" || typeof content.text !== "string") {
    throw new Error("only text channel messages are supported by the first ingress bridge");
  }
  return content.text;
}

function readInboundAttachments(value: unknown): InboundAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === "object" && !Array.isArray(entry))
    )
    .map((entry) => ({
      ...(readString(entry.id) ? { id: readString(entry.id) } : {}),
      ...(readString(entry.name) ? { name: readString(entry.name) } : {}),
      ...(readString(entry.path) ? { path: readString(entry.path) } : {}),
      ...(readString(entry.url) ? { url: readString(entry.url) } : {}),
      ...(readString(entry.assetUri) ? { assetUri: readString(entry.assetUri) } : {}),
      ...(readString(entry.mimeType) ? { mimeType: readString(entry.mimeType) } : {}),
      ...(readOptionalNumber(entry.size) !== undefined ? { size: readOptionalNumber(entry.size) } : {}),
      ...(readString(entry.source) ? { source: readString(entry.source) } : {}),
      ...(entry.status === "ready" || entry.status === "remote-only" ? { status: entry.status } : {}),
      ...(readString(entry.errorCode) ? { errorCode: readString(entry.errorCode) as InboundAttachment["errorCode"] } : {}),
    }));
}

export function toInboundMessage(value: unknown): InboundMessage {
  const payload = readRecord(value);
  return {
    channel: readRequiredString(payload.channelId, "channelId"),
    chatId: readRequiredString(payload.conversationId, "conversationId"),
    senderId: readRequiredString(payload.senderId, "senderId"),
    content: readTextContent(payload.content),
    timestamp: new Date(),
    attachments: readInboundAttachments(payload.attachments),
    metadata: readRecord(payload.metadata),
  };
}

export function normalizeChannelConfigResult(value: unknown): Record<string, unknown> {
  return readRecord(readRecord(value).channelConfig);
}

export function normalizeAuthLoginResult(value: unknown): ExtensionChannelAuthLoginResult {
  const record = readRecord(value);
  return {
    channelConfig: normalizeChannelConfigResult(record),
    accountId: typeof record.accountId === "string" ? record.accountId : null,
    notes: Array.isArray(record.notes) ? record.notes.filter((note): note is string => typeof note === "string") : [],
  };
}

export function normalizeAuthPollResult(value: unknown): ExtensionChannelAuthPollResult | null {
  if (!value) {
    return null;
  }
  const record = readRecord(value);
  return {
    channel: readRequiredString(record.channel, "channel"),
    status: record.status as ExtensionChannelAuthPollResult["status"],
    message: readString(record.message),
    nextPollMs: readOptionalNumber(record.nextPollMs),
    accountId: typeof record.accountId === "string" ? record.accountId : null,
    notes: Array.isArray(record.notes) ? record.notes.filter((note): note is string => typeof note === "string") : [],
    channelConfig: normalizeChannelConfigResult(record),
  };
}
