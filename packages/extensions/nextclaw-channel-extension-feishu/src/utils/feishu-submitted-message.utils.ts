import type { ChannelSubmittedMessageInput } from "@nextclaw/extension-sdk";
import type { FeishuInboundMessage } from "../types/feishu-extension.types.js";

export function toFeishuSubmittedMessage(
  message: FeishuInboundMessage,
): ChannelSubmittedMessageInput {
  return {
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: {
      type: "text",
      text: message.text,
    },
    metadata: {
      accountId: message.accountId,
      account_id: message.accountId,
      peerId: message.conversationId,
      peer_id: message.conversationId,
      peerKind: message.peerKind,
      peer_kind: message.peerKind,
      ...(message.messageId ? { message_id: message.messageId } : {}),
      ...(message.raw === undefined ? {} : { raw: message.raw }),
    },
  };
}
