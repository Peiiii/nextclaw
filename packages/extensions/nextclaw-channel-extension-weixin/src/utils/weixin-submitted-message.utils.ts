import type { ChannelSubmittedMessageInput } from "@nextclaw/extension-sdk";
import type { WeixinInboundMessage } from "../types/weixin-extension.types.js";

export function toWeixinSubmittedMessage(
  message: WeixinInboundMessage,
): ChannelSubmittedMessageInput {
  return {
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: {
      type: "text",
      text: message.text,
    },
    ...(message.attachments ? { attachments: message.attachments } : {}),
    metadata: {
      ...(message.accountId ? { accountId: message.accountId, account_id: message.accountId } : {}),
      ...(message.contextToken ? { context_token: message.contextToken } : {}),
      ...(message.raw === undefined ? {} : { raw: message.raw }),
    },
  };
}
