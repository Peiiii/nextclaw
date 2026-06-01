import { EventBus } from "@nextclaw/shared";
import type {
  ExtensionCapabilities,
  ExtensionCapabilityHandler,
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

function readRequest(payload: unknown): ExtensionRequest | null {
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
}

function normalizeName(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
}

async function handleRequest(
  transport: ExtensionTransportService,
  request: ExtensionRequest,
  handler: ExtensionRequestHandler,
): Promise<void> {
  try {
    const data = await handler(request);
    await transport.respondToRequest({
      requestId: request.requestId,
      ok: true,
      data,
    });
  } catch (error) {
    await transport.respondToRequest({
      requestId: request.requestId,
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

class ExtensionCapabilityRegistry implements ExtensionCapabilities {
  constructor(
    private readonly params: {
      eventBus: EventBus;
      extensionId: string;
      transport: ExtensionTransportService;
    },
  ) {}

  readonly provide = (namespace: string, capability: object): (() => void) => {
    const normalizedNamespace = normalizeName(namespace, "namespace");
    const unsubscribeHandlers = this.readHandlers(capability).map(([name, handler]) =>
      this.provideHandler(`${normalizedNamespace}.${name}`, handler),
    );
    if (unsubscribeHandlers.length === 0) {
      throw new Error(`capability '${normalizedNamespace}' has no callable methods.`);
    }
    return () => {
      for (const unsubscribe of unsubscribeHandlers) {
        unsubscribe();
      }
    };
  };

  readonly provideHandler = (kind: string, handler: ExtensionCapabilityHandler): (() => void) => {
    const normalizedKind = normalizeName(kind, "kind");
    return this.params.eventBus.subscribeAll((event) => {
      if (event.type !== "extension.request") {
        return;
      }
      const request = readRequest(event.payload);
      if (!request || request.extensionId !== this.params.extensionId || request.kind !== normalizedKind) {
        return;
      }
      void handleRequest(this.params.transport, request, async (matchedRequest) =>
        await handler(matchedRequest.payload ?? {}, matchedRequest),
      );
    });
  };

  private readonly readHandlers = (capability: object): Array<[string, ExtensionCapabilityHandler]> =>
    Object.entries(capability).filter(
      (entry): entry is [string, ExtensionCapabilityHandler] => typeof entry[1] === "function",
    );
}

export class NextClawExtension {
  readonly eventBus: EventBus;
  readonly channels: ExtensionChannels;
  readonly capabilities: ExtensionCapabilities;
  readonly extensionId: string;
  private readonly transport: ExtensionTransportService;
  private eventStreamSubscription: { close: () => void } | null = null;

  constructor(options: NextClawExtensionOptions = {}) {
    this.transport = new ExtensionTransportService(options);
    this.extensionId = this.transport.extensionId;
    this.eventBus = new EventBus({
      onFirstSubscriber: () => {
        this.eventStreamSubscription ??= this.transport.subscribe((event) => {
          this.eventBus.emitEnvelope(this.toEventBusEnvelope(event));
        });
      },
      onNoSubscribers: () => {
        this.eventStreamSubscription?.close();
        this.eventStreamSubscription = null;
      },
    });
    this.channels = new ExtensionChannelRegistry({
      eventBus: this.eventBus,
      transport: this.transport,
    });
    this.capabilities = new ExtensionCapabilityRegistry({
      eventBus: this.eventBus,
      extensionId: this.extensionId,
      transport: this.transport,
    });
  }

  readonly close = (): void => {
    this.eventStreamSubscription?.close();
    this.eventStreamSubscription = null;
  };

  readonly onRequest = (handler: ExtensionRequestHandler): (() => void) =>
    this.eventBus.subscribeAll((event) => {
      if (event.type !== "extension.request") {
        return;
      }
      const request = readRequest(event.payload);
      if (!request || request.extensionId !== this.extensionId) {
        return;
      }
      void handleRequest(this.transport, request, handler);
    });

  private readonly toEventBusEnvelope = (event: ExtensionTransportEnvelope): ExtensionTransportEnvelope => ({
    ...event,
    emittedAt: event.emittedAt ?? new Date().toISOString(),
    source: event.source ?? "event-stream",
  });

}
