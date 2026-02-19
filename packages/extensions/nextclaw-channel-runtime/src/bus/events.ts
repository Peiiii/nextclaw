export type InboundAttachmentErrorCode = "too_large" | "download_failed" | "http_error" | "invalid_payload";

export type InboundAttachment = {
  id?: string;
  name?: string;
  path?: string;
  url?: string;
  mimeType?: string;
  size?: number;
  source?: string;
  status?: "ready" | "remote-only";
  errorCode?: InboundAttachmentErrorCode;
};

export type InboundMessage = {
  channel: string;
  senderId: string;
  chatId: string;
  content: string;
  timestamp: Date;
  attachments: InboundAttachment[];
  metadata: Record<string, unknown>;
};

export function inboundSessionKey(msg: InboundMessage): string {
  return `${msg.channel}:${msg.chatId}`;
}

export type OutboundMessage = {
  channel: string;
  chatId: string;
  content: string;
  replyTo?: string | null;
  media: string[];
  metadata: Record<string, unknown>;
};
