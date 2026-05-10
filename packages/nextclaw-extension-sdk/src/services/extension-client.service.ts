import { EventBus } from "@nextclaw/shared";
import type {
  ExtensionChannels,
  ExtensionTransportEnvelope,
  NextClawExtensionOptions,
} from "../types/extension-sdk.types.js";
import { ExtensionChannelService } from "./extension-channel.service.js";
import { ExtensionTransportService } from "./extension-transport.service.js";

class ExtensionChannelRegistry implements ExtensionChannels {
  private readonly channels = new Map<string, ExtensionChannelService>();

  constructor(
    private readonly params: {
      eventBus: EventBus;
      transport: ExtensionTransportService;
    },
  ) {}

  readonly use = (channelId: string): ExtensionChannelService => {
    const normalizedChannelId = channelId.trim();
    if (!normalizedChannelId) {
      throw new Error("channelId is required.");
    }
    const existing = this.channels.get(normalizedChannelId);
    if (existing) {
      return existing;
    }
    const channel = new ExtensionChannelService({
      channelId: normalizedChannelId,
      eventBus: this.params.eventBus,
      transport: this.params.transport,
    });
    this.channels.set(normalizedChannelId, channel);
    return channel;
  };
}

export class NextClawExtension {
  readonly eventBus: EventBus;
  readonly channels: ExtensionChannels;
  readonly extensionId: string;
  private readonly transport: ExtensionTransportService;
  private realtimeSubscription: { close: () => void } | null = null;

  constructor(options: NextClawExtensionOptions = {}) {
    this.transport = new ExtensionTransportService(options);
    this.extensionId = this.transport.extensionId;
    this.eventBus = new EventBus({
      onFirstSubscriber: () => {
        this.realtimeSubscription ??= this.transport.subscribe((event) => {
          this.eventBus.emitEnvelope(this.toEventBusEnvelope(event));
        });
      },
      onNoSubscribers: () => {
        this.realtimeSubscription?.close();
        this.realtimeSubscription = null;
      },
    });
    this.channels = new ExtensionChannelRegistry({
      eventBus: this.eventBus,
      transport: this.transport,
    });
  }

  readonly close = (): void => {
    this.realtimeSubscription?.close();
    this.realtimeSubscription = null;
  };

  private readonly toEventBusEnvelope = (event: ExtensionTransportEnvelope): ExtensionTransportEnvelope => ({
    ...event,
    emittedAt: event.emittedAt ?? new Date().toISOString(),
    source: event.source ?? "realtime",
  });
}
