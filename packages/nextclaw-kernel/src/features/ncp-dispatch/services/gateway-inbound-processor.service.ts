import {
  AgentRouteResolver,
  DIAGNOSTIC_CORRELATION_METADATA_KEY,
  createAssistantStreamDeltaControlMessage,
  createAssistantStreamResetControlMessage,
  createTypingStopControlMessage,
  type Config,
  type DiagnosticRuntime,
  type InboundMessage,
  type MessageBus,
} from "@nextclaw/core";
import type { ChannelManager } from "@kernel/managers/channel.manager.js";
import { CommandRegistry } from "@kernel/services/command-registry.service.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import { classifyDiagnosticError, eventKeys, type EventBus } from "@nextclaw/shared";
import {
  dispatchChannelReplyRoute,
  resolveChannelReplyRoute,
} from "@kernel/features/ncp-dispatch/utils/channel-reply.utils.js";
import {
  buildRunMetadata,
} from "@kernel/utils/agent-run-metadata.utils.js";
import {
  buildAgentRunSendPayload,
  type AssetApi,
} from "@kernel/utils/agent-run-send-payload.utils.js";
import type {
  AgentRunClient,
  AgentRunReply,
} from "@kernel/services/agent-run-client.service.js";

export type GatewayInboundLoopRuntime = {
  kernel: {
    channels: ChannelManager;
    assetStore: AssetApi;
    diagnostics?: Pick<DiagnosticRuntime, "record" | "readCorrelationId">;
  };
  agentRunClient: AgentRunClient;
  messageBus: MessageBus;
  sessionManager: SessionManager;
  configManager: {
    loadConfig: () => Config;
  };
  appEventBus?: EventBus;
};

type GatewayRoute = ReturnType<AgentRouteResolver["resolveInbound"]>;

function formatUserFacingError(error: unknown, maxChars = 320): string {
  const raw =
    error instanceof Error
      ? error.message || error.name
      : String(error ?? "Unknown error");
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Unknown error";
  }
  return normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

export class GatewayInboundProcessor {
  constructor(private runtime: GatewayInboundLoopRuntime) {}

  process = async (message: InboundMessage): Promise<void> => {
    let stage: "route" | "agent" | "reply" = "route";
    const correlationId = this.runtime.kernel.diagnostics?.readCorrelationId(message.metadata);
    const startedAt = Date.now();
    try {
      const route = this.resolveRoute(message);
      this.record({
        domain: "channel.delivery",
        event: "route.resolved",
        component: "kernel.gateway-inbound",
        outcome: "succeeded",
        correlationId,
        facts: { channel: message.channel, direction: "inbound", stage: "route" },
      });
      const runMetadata = buildRunMetadata({
        message,
        route,
      });
      if (await this.dispatchSlashCommandMaybe(message, route, runMetadata)) {
        return;
      }
      if (
        await this.dispatchChannelReplyRouteMaybe(message, route, runMetadata)
      ) {
        return;
      }
      if (message.channel !== "system") {
        await this.runtime.messageBus.publishOutbound(
          createAssistantStreamResetControlMessage(message),
        );
      }
      stage = "agent";
      const agentStartedAt = Date.now();
      this.record({
        domain: "channel.delivery",
        event: "agent.reply-wait.started",
        component: "kernel.gateway-inbound",
        outcome: "started",
        correlationId,
        facts: { source: "channel", channel: message.channel },
      });
      const result = await this.runtime.agentRunClient.sendAndWaitForReply(
        await buildAgentRunSendPayload({
          sessionId: route.sessionKey,
          content: message.content,
          attachments: message.attachments,
          metadata: runMetadata,
          assetApi: this.runtime.kernel.assetStore,
        }),
        {
          onAssistantDelta:
            message.channel !== "system"
              ? (delta) => {
                  if (!delta) {
                    return;
                  }
                  void this.runtime.messageBus.publishOutbound(
                    createAssistantStreamDeltaControlMessage(message, delta),
                  );
                }
              : undefined,
          missingCompletedMessageError: `session "${route.sessionKey}" completed without a final assistant message`,
          runErrorMessage: `session "${route.sessionKey}" failed`,
        },
      );
      this.record({
        domain: "channel.delivery",
        event: "agent.reply-wait.completed",
        component: "kernel.gateway-inbound",
        outcome: "succeeded",
        correlationId,
        durationMs: Date.now() - agentStartedAt,
        facts: { source: "channel", channel: message.channel },
      });
      stage = "reply";
      await this.publishChannelReply(message, route, result);
    } catch (error) {
      const classification = classifyDiagnosticError(error);
      this.record({
        domain: "channel.delivery",
        event: `${stage}.${classification.outcome === "cancelled" ? "cancelled" : "failed"}`,
        component: "kernel.gateway-inbound",
        outcome: classification.outcome,
        correlationId,
        durationMs: Date.now() - startedAt,
        reasonCode: classification.reasonCode,
        providerCode: classification.providerCode,
        facts: { channel: message.channel, stage, ...(classification.facts ?? {}) },
      });
      await this.runtime.messageBus.publishOutbound({
        channel: message.channel,
        chatId: message.chatId,
        content: `Sorry, I encountered an error: ${formatUserFacingError(error)}`,
        media: [],
        metadata: correlationId
          ? { [DIAGNOSTIC_CORRELATION_METADATA_KEY]: correlationId }
          : {},
      });
    }
  };

  private record = (event: Parameters<DiagnosticRuntime["record"]>[0]): void => {
    this.runtime.kernel.diagnostics?.record(event);
  };

  private resolveRoute = (message: InboundMessage): GatewayRoute => {
    const normalize = (value: unknown) =>
      typeof value === "string" ? value.trim() || undefined : undefined;
    return new AgentRouteResolver(
      this.runtime.configManager.loadConfig(),
    ).resolveInbound({
      message,
      forcedAgentId: normalize(message.metadata.target_agent_id),
      sessionKeyOverride: normalize(message.metadata.session_key_override),
    });
  };

  private dispatchSlashCommandMaybe = async (
    message: InboundMessage,
    route: GatewayRoute,
    runMetadata: Record<string, unknown>,
  ): Promise<boolean> => {
    if (message.channel === "system") {
      return false;
    }
    const trimmed = message.content.trim();
    if (!trimmed.startsWith("/")) {
      return false;
    }
    const registry = new CommandRegistry(
      this.runtime.configManager.loadConfig(),
      this.runtime.sessionManager,
    );
    const result = await registry.executeText(trimmed, {
      channel: message.channel,
      chatId: message.chatId,
      senderId: message.senderId,
      sessionKey: route.sessionKey,
    });
    if (!result) {
      return false;
    }
    await this.runtime.messageBus.publishOutbound({
      channel: message.channel,
      chatId: message.chatId,
      content: result.content,
      media: [],
      metadata: runMetadata,
    });
    return true;
  };

  private dispatchChannelReplyRouteMaybe = async (
    message: InboundMessage,
    route: GatewayRoute,
    runMetadata: Record<string, unknown>,
  ): Promise<boolean> => {
    if (message.channel === "system") {
      return false;
    }

    const replyRoute = resolveChannelReplyRoute({
      channel: this.runtime.kernel.channels.getChannel(message.channel),
      message,
      route,
    });
    if (!replyRoute) {
      return false;
    }

    await dispatchChannelReplyRoute({
      agentRunClient: this.runtime.agentRunClient,
      assetApi: this.runtime.kernel.assetStore,
      route: replyRoute,
      sessionId: route.sessionKey,
      content: message.content,
      attachments: message.attachments,
      metadata: runMetadata,
    });
    return true;
  };

  private publishChannelReply = async (
    message: InboundMessage,
    route: GatewayRoute,
    result: AgentRunReply,
  ): Promise<void> => {
    if (message.channel === "system") {
      this.runtime.appEventBus?.emit(
        eventKeys.sessionUpdated,
        { sessionKey: route.sessionKey },
        {
          emittedAt: new Date().toISOString(),
          source: "backend",
        },
      );
      return;
    }

    const replyText = result.text.trim();
    if (!replyText) {
      await this.runtime.messageBus.publishOutbound(
        createTypingStopControlMessage(message),
      );
      this.record({
        domain: "channel.delivery",
        event: "reply.suppressed",
        component: "kernel.gateway-inbound",
        outcome: "suppressed",
        correlationId: this.runtime.kernel.diagnostics?.readCorrelationId(message.metadata),
        reasonCode: "empty_reply",
        facts: { channel: message.channel, stage: "reply" },
      });
      return;
    }

    await this.runtime.messageBus.publishOutbound({
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
    this.record({
      domain: "channel.delivery",
      event: "reply.queued",
      component: "kernel.gateway-inbound",
      outcome: "accepted",
      correlationId: this.runtime.kernel.diagnostics?.readCorrelationId(message.metadata),
      facts: { channel: message.channel, stage: "reply" },
    });
  };
}

export async function runGatewayInboundLoop(
  runtime: GatewayInboundLoopRuntime,
): Promise<void> {
  const processor = new GatewayInboundProcessor(runtime);
  while (true) {
    await processor.process(await runtime.messageBus.consumeInbound());
  }
}
