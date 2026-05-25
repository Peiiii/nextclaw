import {
  AgentRouteResolver,
  CommandRegistry,
  parseAgentScopedSessionKey,
  type Config,
  type InboundAttachment,
  type InboundMessage,
} from "@nextclaw/core";
import { buildRunMetadata } from "./ncp-run-metadata.utils.js";
import {
  buildAgentRunSendPayload,
  type AgentRunClient,
} from "./nextclaw-ncp-runner.utils.js";
export type DirectPromptDispatchParams = {
  config: Config;
  agentRunClient: AgentRunClient;
  content: string;
  sessionKey?: string;
  channel?: string;
  chatId?: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
  agentId?: string;
  abortSignal?: AbortSignal;
  onAssistantDelta?: (delta: string) => void;
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function createDirectInboundMessage(params: {
  content: string;
  channel?: string;
  chatId?: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
}): InboundMessage {
  const { attachments, channel, chatId, content, metadata } = params;
  return {
    channel: channel ?? "cli",
    senderId: "user",
    chatId: chatId ?? "direct",
    content,
    timestamp: new Date(),
    attachments: attachments ?? [],
    metadata: structuredClone(metadata ?? {}),
  };
}

async function executeSlashCommandMaybe(params: {
  config: Config;
  rawContent: string;
  channel: string;
  chatId: string;
  sessionKey: string;
}): Promise<string | null> {
  const { channel, chatId, config, rawContent, sessionKey } = params;
  const trimmed = rawContent.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  const registry = new CommandRegistry(config);
  const result = await registry.executeText(rawContent, {
    channel,
    chatId,
    senderId: "user",
    sessionKey,
  });
  return result?.content ?? null;
}

function resolveDirectRoute(params: {
  config: Config;
  content: string;
  sessionKey?: string;
  channel?: string;
  chatId?: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
  agentId?: string;
}): {
  message: InboundMessage;
  route: ReturnType<AgentRouteResolver["resolveInbound"]>;
} {
  const { agentId, config, sessionKey } = params;
  const message = createDirectInboundMessage(params);
  const forcedAgentId =
    normalizeOptionalString(agentId) ??
    parseAgentScopedSessionKey(sessionKey)?.agentId ??
    undefined;
  const routeResolver = new AgentRouteResolver(config);
  const route = routeResolver.resolveInbound({
    message,
    forcedAgentId,
    sessionKeyOverride: sessionKey,
  });
  return {
    message,
    route,
  };
}

export async function dispatchPromptOverNcp(
  params: DirectPromptDispatchParams,
): Promise<string> {
  const {
    abortSignal,
    agentId,
    attachments,
    channel,
    chatId,
    config,
    content,
    metadata,
    onAssistantDelta,
    agentRunClient,
    sessionKey,
  } = params;
  const { message, route } = resolveDirectRoute({
    config,
    content,
    sessionKey,
    channel,
    chatId,
    attachments,
    metadata,
    agentId,
  });
  const commandResult = await executeSlashCommandMaybe({
    config,
    rawContent: content,
    channel: message.channel,
    chatId: message.chatId,
    sessionKey: route.sessionKey,
  });
  if (commandResult) {
    return commandResult;
  }

  const result = await agentRunClient.sendAndWaitForReply(await buildAgentRunSendPayload({
    sessionId: route.sessionKey,
    content,
    attachments,
    metadata: buildRunMetadata({
      message,
      route,
    }),
  }), {
    abortSignal,
    onAssistantDelta,
    missingCompletedMessageError: `session "${route.sessionKey}" completed without a final assistant message`,
    runErrorMessage: `session "${route.sessionKey}" failed`,
  });
  return result.text;
}
