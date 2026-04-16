import {
  AgentRouteResolver,
  type ChannelManager,
  CommandRegistry,
  createAssistantStreamDeltaControlMessage,
  createAssistantStreamResetControlMessage,
  createTypingStopControlMessage,
  parseAgentScopedSessionKey,
  type Config,
  type InboundAttachment,
  type InboundMessage,
  type MessageBus,
  type SessionManager,
} from "@nextclaw/core";
import { runPromptOverNcp, type NcpRunnerAgent } from "./nextclaw-ncp-runner.js";
import type { ChannelReplyRouterService } from "./runner/channel-reply-router.service.js";
export type DirectPromptDispatchParams = {
  config: Config;
  sessionManager: SessionManager;
  resolveNcpAgent?: () => NcpRunnerAgent | null;
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

export type GatewayInboundLoopParams = {
  bus: MessageBus;
  sessionManager: SessionManager;
  getConfig: () => Config;
  resolveNcpAgent?: () => NcpRunnerAgent | null;
  getChannels?: () => ChannelManager;
  replyRouter?: ChannelReplyRouterService;
  onSystemSessionUpdated?: (params: {
    sessionKey: string;
    message: InboundMessage;
  }) => void;
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function requireNcpAgent(
  resolveNcpAgent: (() => NcpRunnerAgent | null) | undefined,
  purpose: string,
): NcpRunnerAgent {
  const agent = resolveNcpAgent?.() ?? null;
  if (!agent) {
    throw new Error(`NCP agent is not ready for ${purpose}.`);
  }
  return agent;
}

function createDirectInboundMessage(params: {
  content: string;
  channel?: string;
  chatId?: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
}): InboundMessage {
  return {
    channel: params.channel ?? "cli",
    senderId: "user",
    chatId: params.chatId ?? "direct",
    content: params.content,
    timestamp: new Date(),
    attachments: params.attachments ?? [],
    metadata: structuredClone(params.metadata ?? {}),
  };
}

function buildRunMetadata(params: {
  message: Pick<InboundMessage, "channel" | "chatId" | "metadata" | "senderId">;
  route: ReturnType<AgentRouteResolver["resolveInbound"]>;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...(params.message.metadata ?? {}),
    ...(params.metadata ?? {}),
    channel: params.message.channel,
    chatId: params.message.chatId,
    chat_id: params.message.chatId,
    accountId: params.route.accountId,
    account_id: params.route.accountId,
    agentId: params.route.agentId,
    agent_id: params.route.agentId,
    sessionKey: params.route.sessionKey,
    session_key: params.route.sessionKey,
    senderId: params.message.senderId,
    sender_id: params.message.senderId,
  };
}

async function executeSlashCommandMaybe(params: {
  config: Config;
  sessionManager: SessionManager;
  rawContent: string;
  channel: string;
  chatId: string;
  sessionKey: string;
}): Promise<string | null> {
  const trimmed = params.rawContent.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  const registry = new CommandRegistry(params.config, params.sessionManager);
  const result = await registry.executeText(params.rawContent, {
    channel: params.channel,
    chatId: params.chatId,
    senderId: "user",
    sessionKey: params.sessionKey,
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
  const message = createDirectInboundMessage(params);
  const forcedAgentId =
    normalizeOptionalString(params.agentId) ??
    parseAgentScopedSessionKey(params.sessionKey)?.agentId ??
    undefined;
  const routeResolver = new AgentRouteResolver(params.config);
  const route = routeResolver.resolveInbound({
    message,
    forcedAgentId,
    sessionKeyOverride: params.sessionKey,
  });
  return {
    message,
    route,
  };
}

function formatUserFacingError(error: unknown, maxChars = 320): string {
  const raw =
    error instanceof Error
      ? error.message || error.name || "Unknown error"
      : String(error ?? "Unknown error");
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Unknown error";
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

type GatewayDispatchContext = {
  agent: NcpRunnerAgent;
  message: InboundMessage;
  route: ReturnType<AgentRouteResolver["resolveInbound"]>;
  runMetadata: Record<string, unknown>;
};

async function dispatchChannelReplyRouteMaybe(
  params: GatewayInboundLoopParams,
  context: GatewayDispatchContext,
): Promise<boolean> {
  if (
    context.message.channel === "system" ||
    !params.replyRouter ||
    !params.getChannels
  ) {
    return false;
  }

  const replyRoute = params.replyRouter.resolveRoute({
    channel: params.getChannels().getChannel(context.message.channel),
    message: context.message,
    route: context.route,
  });
  if (!replyRoute) {
    return false;
  }

  await params.replyRouter.dispatch({
    agent: context.agent,
    route: replyRoute,
    sessionId: context.route.sessionKey,
    content: context.message.content,
    attachments: context.message.attachments,
    metadata: context.runMetadata,
  });
  return true;
}

async function publishLegacyReply(
  params: GatewayInboundLoopParams,
  context: GatewayDispatchContext,
  result: Awaited<ReturnType<typeof runPromptOverNcp>>,
): Promise<void> {
  if (context.message.channel === "system") {
    params.onSystemSessionUpdated?.({
      sessionKey: context.route.sessionKey,
      message: context.message,
    });
    return;
  }

  const replyText = result.text.trim();
  if (!replyText) {
    await params.bus.publishOutbound(
      createTypingStopControlMessage(context.message),
    );
    return;
  }

  await params.bus.publishOutbound({
    channel: context.message.channel,
    chatId: context.message.chatId,
    content: result.text,
    media: [],
    metadata: buildRunMetadata({
      message: context.message,
      route: context.route,
      metadata: result.completedMessage.metadata,
    }),
  });
}

export async function dispatchPromptOverNcp(
  params: DirectPromptDispatchParams,
): Promise<string> {
  const { message, route } = resolveDirectRoute({
    config: params.config,
    content: params.content,
    sessionKey: params.sessionKey,
    channel: params.channel,
    chatId: params.chatId,
    attachments: params.attachments,
    metadata: params.metadata,
    agentId: params.agentId,
  });
  const commandResult = await executeSlashCommandMaybe({
    config: params.config,
    sessionManager: params.sessionManager,
    rawContent: params.content,
    channel: message.channel,
    chatId: message.chatId,
    sessionKey: route.sessionKey,
  });
  if (commandResult) {
    return commandResult;
  }

  const agent = requireNcpAgent(params.resolveNcpAgent, "direct dispatch");
  const result = await runPromptOverNcp({
    agent,
    sessionId: route.sessionKey,
    content: params.content,
    attachments: params.attachments,
    metadata: buildRunMetadata({
      message,
      route,
    }),
    abortSignal: params.abortSignal,
    onAssistantDelta: params.onAssistantDelta,
    missingCompletedMessageError: `session "${route.sessionKey}" completed without a final assistant message`,
    runErrorMessage: `session "${route.sessionKey}" failed`,
  });
  return result.text;
}

export async function runGatewayInboundLoop(
  params: GatewayInboundLoopParams,
): Promise<void> {
  while (true) {
    const message = await params.bus.consumeInbound();
    let usedChannelReplyRoute = false;
    try {
      const explicitSessionKey = normalizeOptionalString(
        message.metadata.session_key_override,
      );
      const forcedAgentId = normalizeOptionalString(
        message.metadata.target_agent_id,
      );
      const route = new AgentRouteResolver(params.getConfig()).resolveInbound({
        message,
        forcedAgentId,
        sessionKeyOverride: explicitSessionKey,
      });
      const agent = requireNcpAgent(
        params.resolveNcpAgent,
        "gateway dispatch",
      );
      const runMetadata = buildRunMetadata({
        message,
        route,
      });
      const context: GatewayDispatchContext = {
        agent,
        message,
        route,
        runMetadata,
      };

      if (await dispatchChannelReplyRouteMaybe(params, context)) {
        usedChannelReplyRoute = true;
        continue;
      }

      if (message.channel !== "system") {
        await params.bus.publishOutbound(
          createAssistantStreamResetControlMessage(message),
        );
      }
      const result = await runPromptOverNcp({
        agent,
        sessionId: route.sessionKey,
        content: message.content,
        attachments: message.attachments,
        metadata: runMetadata,
        onAssistantDelta:
          message.channel !== "system"
            ? (delta) => {
                if (!delta) {
                  return;
                }
                void params.bus.publishOutbound(
                  createAssistantStreamDeltaControlMessage(message, delta),
                );
              }
            : undefined,
        missingCompletedMessageError: `session "${route.sessionKey}" completed without a final assistant message`,
        runErrorMessage: `session "${route.sessionKey}" failed`,
      });
      await publishLegacyReply(params, context, result);
    } catch (error) {
      if (usedChannelReplyRoute) {
        continue;
      }
      await params.bus.publishOutbound({
        channel: message.channel,
        chatId: message.chatId,
        content: `Sorry, I encountered an error: ${formatUserFacingError(error)}`,
        media: [],
        metadata: {},
      });
    }
  }
}
