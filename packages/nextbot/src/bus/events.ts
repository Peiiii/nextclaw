export type InboundMessage = {
  channel: string;
  senderId: string;
  chatId: string;
  content: string;
  timestamp: Date;
  media: string[];
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
