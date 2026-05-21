import type { AgentRouteResolver, InboundMessage } from "@nextclaw/core";

export function buildRunMetadata(params: {
  message: Pick<InboundMessage, "channel" | "chatId" | "metadata" | "senderId">;
  route: ReturnType<AgentRouteResolver["resolveInbound"]>;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const { message, metadata, route } = params;
  return {
    ...(message.metadata ?? {}),
    ...(metadata ?? {}),
    channel: message.channel,
    chatId: message.chatId,
    chat_id: message.chatId,
    accountId: route.accountId,
    account_id: route.accountId,
    agentId: route.agentId,
    agent_id: route.agentId,
    sessionKey: route.sessionKey,
    session_key: route.sessionKey,
    senderId: message.senderId,
    sender_id: message.senderId,
  };
}
