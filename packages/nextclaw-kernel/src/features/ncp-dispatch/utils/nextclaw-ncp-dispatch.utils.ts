import {
  AgentRouteResolver,
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
  type ChannelManager,
} from "@nextclaw/core";
import { eventKeys, type EventBus } from "@nextclaw/shared";
import { runPromptOverNcp, type NcpRunnerAgent } from "./nextclaw-ncp-runner.utils.js";
import {
  dispatchChannelReplyRoute,
  resolveChannelReplyRoute,
} from "./channel-reply.utils.js";
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

export type GatewayInboundLoopRuntime = {
  kernel: {
    channels: ChannelManager;
    agentRunRequestManager: NcpRunnerAgent;
  };
  messageBus: MessageBus;
  sessionManager: SessionManager;
  configManager: {
    loadConfig: () => Config;
  };
  appEventBus?: EventBus;
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

function buildRunMetadata(params: {
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

async function executeSlashCommandMaybe(params: {
  config: Config;
  sessionManager: SessionManager;
  rawContent: string;
  channel: string;
  chatId: string;
  sessionKey: string;
}): Promise<string | null> {
  const { channel, chatId, config, rawContent, sessionKey, sessionManager } = params;
  const trimmed = rawContent.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  const registry = new CommandRegistry(config, sessionManager);
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
  runtime: GatewayInboundLoopRuntime,
  context: GatewayDispatchContext,
): Promise<boolean> {
  const { message, route, agent, runMetadata } = context;
  if (
    message.channel === "system"
  ) {
    return false;
  }

  const replyRoute = resolveChannelReplyRoute({
    channel: runtime.kernel.channels.getChannel(message.channel),
    message,
    route,
  });
  if (!replyRoute) {
    return false;
  }

  await dispatchChannelReplyRoute({
    agent,
    route: replyRoute,
    sessionId: route.sessionKey,
    content: message.content,
    attachments: message.attachments,
    metadata: runMetadata,
  });
  return true;
}

async function publishLegacyReply(
  runtime: GatewayInboundLoopRuntime,
  context: GatewayDispatchContext,
  result: Awaited<ReturnType<typeof runPromptOverNcp>>,
): Promise<void> {
  const { message, route } = context;
  if (message.channel === "system") {
    runtime.appEventBus?.emit(eventKeys.sessionUpdated, { sessionKey: route.sessionKey }, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
    return;
  }

  const replyText = result.text.trim();
  if (!replyText) {
    await runtime.messageBus.publishOutbound(
      createTypingStopControlMessage(message),
    );
    return;
  }

  await runtime.messageBus.publishOutbound({
    channel: message.channel,
    chatId: message.chatId,
    content: result.text,
    media: [],
    metadata: buildRunMetadata({
      message,
      route,
      metadata: result.completedMessage.metadata,
    }),
  });
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
    resolveNcpAgent,
    sessionKey,
    sessionManager,
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
    sessionManager,
    rawContent: content,
    channel: message.channel,
    chatId: message.chatId,
    sessionKey: route.sessionKey,
  });
  if (commandResult) {
    return commandResult;
  }

  const agent = requireNcpAgent(resolveNcpAgent, "direct dispatch");
  const result = await runPromptOverNcp({
    agent,
    sessionId: route.sessionKey,
    content,
    attachments,
    metadata: buildRunMetadata({
      message,
      route,
    }),
    abortSignal,
    onAssistantDelta,
    missingCompletedMessageError: `session "${route.sessionKey}" completed without a final assistant message`,
    runErrorMessage: `session "${route.sessionKey}" failed`,
  });
  return result.text;
}

export async function runGatewayInboundLoop(
  runtime: GatewayInboundLoopRuntime,
): Promise<void> {
  while (true) {
    const message = await runtime.messageBus.consumeInbound();
    let usedChannelReplyRoute = false;
    try {
      const explicitSessionKey = normalizeOptionalString(
        message.metadata.session_key_override,
      );
      const forcedAgentId = normalizeOptionalString(
        message.metadata.target_agent_id,
      );
      const route = new AgentRouteResolver(runtime.configManager.loadConfig()).resolveInbound({
        message,
        forcedAgentId,
        sessionKeyOverride: explicitSessionKey,
      });
      const agent = requireNcpAgent(
        () => runtime.kernel.agentRunRequestManager,
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

      if (await dispatchChannelReplyRouteMaybe(runtime, context)) {
        usedChannelReplyRoute = true;
        continue;
      }

      if (message.channel !== "system") {
        await runtime.messageBus.publishOutbound(
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
                void runtime.messageBus.publishOutbound(
                  createAssistantStreamDeltaControlMessage(message, delta),
                );
              }
            : undefined,
        missingCompletedMessageError: `session "${route.sessionKey}" completed without a final assistant message`,
        runErrorMessage: `session "${route.sessionKey}" failed`,
      });
      await publishLegacyReply(runtime, context, result);
    } catch (error) {
      if (usedChannelReplyRoute) {
        continue;
      }
      await runtime.messageBus.publishOutbound({
        channel: message.channel,
        chatId: message.chatId,
        content: `Sorry, I encountered an error: ${formatUserFacingError(error)}`,
        media: [],
        metadata: {},
      });
    }
  }
}
