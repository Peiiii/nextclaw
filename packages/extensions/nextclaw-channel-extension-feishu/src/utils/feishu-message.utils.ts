export type FeishuMessageEvent = {
  sender?: {
    sender_id?: {
      open_id?: string;
      user_id?: string;
    };
    sender_type?: string;
  };
  message?: {
    chat_id?: string;
    chat_type?: string;
    content?: string;
    mentions?: Array<{
      id?: {
        open_id?: string;
        user_id?: string;
      };
    }>;
    message_id?: string;
    message_type?: string;
  };
};

export type ParsedFeishuInboundMessage = {
  chatId: string;
  senderOpenId: string;
  text: string;
  messageId?: string;
  chatType: string;
  mentionedOpenIds: string[];
};

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseTextContent(raw: string | undefined): string {
  if (!raw) {
    return "";
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return readString(parsed.text) ?? "";
  } catch {
    return raw;
  }
}

function readMentionOpenIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => readString(readRecord(readRecord(entry)?.id)?.open_id))
    .filter((entry): entry is string => Boolean(entry));
}

export function parseFeishuInboundMessage(value: unknown): ParsedFeishuInboundMessage | null {
  const event = value as FeishuMessageEvent;
  const chatId = readString(event.message?.chat_id);
  const senderOpenId = readString(event.sender?.sender_id?.open_id);
  if (!chatId || !senderOpenId || event.sender?.sender_type === "app") {
    return null;
  }
  const text = parseTextContent(event.message?.content);
  if (!text.trim()) {
    return null;
  }
  return {
    chatId,
    senderOpenId,
    text,
    messageId: readString(event.message?.message_id),
    chatType: readString(event.message?.chat_type) ?? "p2p",
    mentionedOpenIds: readMentionOpenIds(event.message?.mentions),
  };
}

export function isFeishuGroupChat(chatType: string): boolean {
  return chatType !== "p2p";
}

export function isFeishuBotMentioned(params: {
  botOpenId?: string;
  mentionedOpenIds: string[];
}): boolean {
  return Boolean(params.botOpenId && params.mentionedOpenIds.includes(params.botOpenId));
}
