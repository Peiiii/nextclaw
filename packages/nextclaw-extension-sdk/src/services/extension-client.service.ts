import { EventBus } from "@nextclaw/shared";
import type {
  ExtensionChannels,
  ExtensionRequest,
  ExtensionRequestHandler,
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

  readonly onRequest = (handler: ExtensionRequestHandler): (() => void) =>
    this.eventBus.subscribeAll((event) => {
      if (event.type !== "extension.request") {
        return;
      }
      const request = this.readRequest(event.payload);
      if (!request || request.extensionId !== this.extensionId) {
        return;
      }
      void this.handleRequest(request, handler);
    });

  private readonly toEventBusEnvelope = (event: ExtensionTransportEnvelope): ExtensionTransportEnvelope => ({
    ...event,
    emittedAt: event.emittedAt ?? new Date().toISOString(),
    source: event.source ?? "realtime",
  });

  private readonly handleRequest = async (
    request: ExtensionRequest,
    handler: ExtensionRequestHandler,
  ): Promise<void> => {
    try {
      const data = await handler(request);
      await this.transport.respondToRequest({
        requestId: request.requestId,
        ok: true,
        data,
      });
    } catch (error) {
      await this.transport.respondToRequest({
        requestId: request.requestId,
        ok: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  private readonly readRequest = (payload: unknown): ExtensionRequest | null => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    const record = payload as Record<string, unknown>;
    if (
      typeof record.requestId !== "string" ||
      typeof record.extensionId !== "string" ||
      typeof record.kind !== "string"
    ) {
      return null;
    }
    return {
      requestId: record.requestId,
      extensionId: record.extensionId,
      kind: record.kind,
      payload: record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
        ? record.payload as Record<string, unknown>
        : {},
    };
  };
}
