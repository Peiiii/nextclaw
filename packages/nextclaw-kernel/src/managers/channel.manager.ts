import { evaluateSilentReply, ExtensionChannelAdapter, isNextclawControlMessage, sanitizeOutboundAssistantContent } from "@nextclaw/core";
import type { BaseChannel, Config, DiagnosticRuntime, ExtensionRegistry, MessageBus, OutboundMessage } from "@nextclaw/core";
import { classifyDiagnosticError } from "@nextclaw/shared";

export class ChannelManager {
  private channels: Record<string, BaseChannel<Record<string, unknown>>> = {};
  private channelConfig: Config | null = null;
  private dispatching = false;
  private dispatchTask: Promise<void> | null = null;
  private extensionChannels: ExtensionRegistry["channels"] = [];

  constructor(
    private readonly deps: {
      bus: MessageBus;
      diagnostics?: Pick<DiagnosticRuntime, "record" | "readCorrelationId">;
    },
  ) {}

  readonly load = (params: {
    channelConfig: Config;
    extensionChannels?: ExtensionRegistry["channels"];
  }): void => {
    this.channelConfig = params.channelConfig;
    this.extensionChannels = params.extensionChannels ?? [];
    this.channels = {};
    this.initChannels();
  };

  readonly reload = async (params: {
    channelConfig: Config;
    extensionChannels?: ExtensionRegistry["channels"];
    start?: boolean;
  }): Promise<void> => {
    await this.stop();
    this.load(params);
    if (params.start === true) {
      await this.start();
    }
  };

  readonly start = async (): Promise<void> => {
    if (!Object.keys(this.channels).length || this.dispatching) {
      return;
    }
    this.dispatching = true;
    this.dispatchTask = this.dispatchOutbound();
    await Promise.allSettled(
      Object.entries(this.channels).map(([name, channel]) => this.startChannel(name, channel)),
    );
  };

  readonly stop = async (): Promise<void> => {
    this.dispatching = false;
    if (this.dispatchTask) {
      await this.deps.bus.publishOutbound({
        channel: "__control__",
        chatId: "",
        content: "",
        media: [],
        metadata: { reason: "shutdown" },
      });
      await this.dispatchTask;
    }
    await Promise.allSettled(
      Object.entries(this.channels).map(async ([name, channel]) => {
        try {
          await channel.stop();
        } catch (error) {
          console.error(`Error stopping ${name}: ${String(error)}`);
        }
      }),
    );
    this.dispatchTask = null;
  };

  readonly status = (): Record<string, { enabled: boolean; running: boolean }> =>
    Object.fromEntries(
      Object.entries(this.channels).map(([name, channel]) => [
        name,
        { enabled: true, running: channel.isRunning },
      ]),
    );

  get enabledChannels(): string[] {
    return Object.keys(this.channels);
  }

  readonly getChannel = (name: string): BaseChannel<Record<string, unknown>> | null =>
    this.channels[name] ?? null;

  readonly deliver = async (message: OutboundMessage): Promise<boolean> => {
    const channel = this.channels[message.channel];
    if (!channel) {
      this.recordDelivery(message, "outbound.send.rejected", "rejected", {
        reasonCode: "channel_unavailable",
      });
      return false;
    }
    if (isNextclawControlMessage(message)) {
      await channel.handleControlMessage(message);
      return true;
    }
    const outbound = this.normalizeOutbound(message);
    if (!outbound) {
      this.recordDelivery(message, "reply.suppressed", "suppressed", {
        reasonCode: "silent_reply",
      });
      return true;
    }
    const startedAt = Date.now();
    this.recordDelivery(message, "outbound.send.started", "started");
    try {
      await channel.send(outbound);
      this.recordDelivery(message, "outbound.send.succeeded", "succeeded", {
        durationMs: Date.now() - startedAt,
      });
      return true;
    } catch (error) {
      const classification = classifyDiagnosticError(error);
      this.recordDelivery(message, classification.outcome === "cancelled" ? "outbound.send.cancelled" : "outbound.send.failed", classification.outcome, {
        durationMs: Date.now() - startedAt,
        reasonCode: classification.reasonCode,
        providerCode: classification.providerCode,
        facts: classification.facts,
      });
      throw error;
    }
  };

  private readonly recordDelivery = (
    message: OutboundMessage,
    event: string,
    outcome: "started" | "succeeded" | "rejected" | "cancelled" | "failed" | "suppressed",
    details: {
      durationMs?: number;
      reasonCode?: string;
      providerCode?: string;
      facts?: Record<string, string | number | boolean | null>;
    } = {},
  ): void => {
    this.deps.diagnostics?.record({
      domain: "channel.delivery",
      event,
      component: "kernel.channel-manager",
      outcome,
      correlationId: this.deps.diagnostics.readCorrelationId(message.metadata),
      durationMs: details.durationMs,
      reasonCode: details.reasonCode,
      providerCode: details.providerCode,
      facts: {
        channel: message.channel,
        direction: "outbound",
        stage: "provider",
        ...(details.facts ?? {}),
      },
    });
  };

  private readonly initChannels = (): void => {
    if (!this.channelConfig) {
      return;
    }
    for (const registration of this.extensionChannels) {
      const id = registration.channel.id;
      if (!id) {
        continue;
      }
      if (this.channels[id]) {
        console.warn(`Extension channel ignored because id already exists: ${id}`);
        continue;
      }
      this.channels[id] = new ExtensionChannelAdapter(this.channelConfig, this.deps.bus, registration);
    }
  };

  private readonly startChannel = async (
    name: string,
    channel: BaseChannel<Record<string, unknown>>,
  ): Promise<void> => {
    try {
      await channel.start();
    } catch (error) {
      console.error(`Failed to start channel ${name}: ${String(error)}`);
    }
  };

  private readonly normalizeOutbound = (message: OutboundMessage): OutboundMessage | null => {
    const sanitizedContent = sanitizeOutboundAssistantContent(message.content ?? "");
    const silentReplyDecision = evaluateSilentReply({
      content: sanitizedContent,
      media: message.media,
    });
    if (silentReplyDecision.shouldDrop) {
      return null;
    }
    if (silentReplyDecision.content === message.content) {
      return message;
    }
    return {
      ...message,
      content: silentReplyDecision.content,
    };
  };

  private readonly dispatchOutbound = async (): Promise<void> => {
    while (this.dispatching) {
      const message = await this.deps.bus.consumeOutbound();
      try {
        await this.deliver(message);
      } catch {
        // deliver() records the structured failure before keeping the dispatcher alive.
      }
    }
  };
}
