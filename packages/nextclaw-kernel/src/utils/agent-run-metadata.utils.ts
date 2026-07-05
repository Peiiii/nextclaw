import type { AgentRouteResolver, InboundMessage } from "@nextclaw/core";

export const AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY = "run_spec";

const LEGACY_RUN_METADATA_KEYS = [
  "account_id",
  "agent_id",
  "chat_id",
  "preferred_model",
  "project_root",
  "runtime",
  "sender_id",
  "session_key",
  "session_type",
] as const;

function stripLegacyRunMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const nextMetadata = structuredClone(metadata);
  for (const key of LEGACY_RUN_METADATA_KEYS) {
    delete nextMetadata[key];
  }
  return nextMetadata;
}

export function buildRunMetadata(params: {
  message: Pick<InboundMessage, "channel" | "chatId" | "metadata" | "senderId">;
  route: ReturnType<AgentRouteResolver["resolveInbound"]>;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const { message, metadata, route } = params;
  const metadataContext = stripLegacyRunMetadata({
    ...(message.metadata ?? {}),
    ...(metadata ?? {}),
  });
  return {
    ...metadataContext,
    channel: message.channel,
    chatId: message.chatId,
    accountId: route.accountId,
    agentId: route.agentId,
    sessionKey: route.sessionKey,
    senderId: message.senderId,
  };
}
