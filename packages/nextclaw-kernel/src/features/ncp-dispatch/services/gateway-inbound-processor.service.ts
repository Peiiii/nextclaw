import {
  AgentRouteResolver,
  createAssistantStreamDeltaControlMessage,
  createAssistantStreamResetControlMessage,
  createTypingStopControlMessage,
  type ChannelManager,
  type Config,
  type InboundMessage,
  type MessageBus,
} from "@nextclaw/core";
import { eventKeys, type EventBus } from "@nextclaw/shared";
import {
  dispatchChannelReplyRoute,
  resolveChannelReplyRoute,
} from "@kernel/features/ncp-dispatch/utils/channel-reply.utils.js";
import { buildRunMetadata } from "@kernel/features/ncp-dispatch/utils/ncp-run-metadata.utils.js";
import {
  runPromptOverNcp,
  type NcpRunnerAgent,
} from "@kernel/features/ncp-dispatch/utils/nextclaw-ncp-runner.utils.js";

export type GatewayInboundLoopRuntime = {
  kernel: {
    channels: ChannelManager;
    agentRunRequestManager: NcpRunnerAgent;
  };
  messageBus: MessageBus;
  configManager: {
    loadConfig: () => Config;
  };
  appEventBus?: EventBus;
};

type GatewayRoute = ReturnType<AgentRouteResolver["resolveInbound"]>;

function formatUserFacingError(error: unknown, maxChars = 320): string {
  const raw = error instanceof Error ? error.message || error.name : String(error ?? "Unknown error");
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
    try {
      const route = this.resolveRoute(message);
      const runMetadata = buildRunMetadata({
        message,
        route,
      });
      if (await this.dispatchChannelReplyRouteMaybe(message, route, runMetadata)) {
        return;
      }
      if (message.channel !== "system") {
        await this.runtime.messageBus.publishOutbound(
          createAssistantStreamResetControlMessage(message),
        );
      }
      const result = await runPromptOverNcp({
        agent: this.runtime.kernel.agentRunRequestManager,
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
                void this.runtime.messageBus.publishOutbound(
                  createAssistantStreamDeltaControlMessage(message, delta),
                );
              }
            : undefined,
        missingCompletedMessageError: `session "${route.sessionKey}" completed without a final assistant message`,
        runErrorMessage: `session "${route.sessionKey}" failed`,
      });
      await this.publishLegacyReply(message, route, result);
    } catch (error) {
      await this.runtime.messageBus.publishOutbound({
        channel: message.channel,
        chatId: message.chatId,
        content: `Sorry, I encountered an error: ${formatUserFacingError(error)}`,
        media: [],
        metadata: {},
      });
    }
  };

  private resolveRoute = (message: InboundMessage): GatewayRoute => {
    const normalize = (value: unknown) =>
      typeof value === "string" ? value.trim() || undefined : undefined;
    return new AgentRouteResolver(this.runtime.configManager.loadConfig()).resolveInbound({
      message,
      forcedAgentId: normalize(message.metadata.target_agent_id),
      sessionKeyOverride: normalize(message.metadata.session_key_override),
    });
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
      agent: this.runtime.kernel.agentRunRequestManager,
      route: replyRoute,
      sessionId: route.sessionKey,
      content: message.content,
      attachments: message.attachments,
      metadata: runMetadata,
    });
    return true;
  };

  private publishLegacyReply = async (
    message: InboundMessage,
    route: GatewayRoute,
    result: Awaited<ReturnType<typeof runPromptOverNcp>>,
  ): Promise<void> => {
    if (message.channel === "system") {
      this.runtime.appEventBus?.emit(eventKeys.sessionUpdated, { sessionKey: route.sessionKey }, {
        emittedAt: new Date().toISOString(),
        source: "backend",
      });
      return;
    }

    const replyText = result.text.trim();
    if (!replyText) {
      await this.runtime.messageBus.publishOutbound(
        createTypingStopControlMessage(message),
      );
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
