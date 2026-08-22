import { getKeyId, ingressKeys, type Unsubscribe } from "@nextclaw/shared";
import type {
  ExtensionObservationEmitInput,
  ExtensionObservationHandlers,
  ExtensionObservations,
} from "../types/extension-sdk.types.js";
import type { ExtensionTransportService } from "./extension-transport.service.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

export class ExtensionObservationService implements ExtensionObservations {
  private readonly subscriptions = new Map<
    string,
    {
      abort: AbortController;
      cleanup?: () => void | Promise<void>;
      ready: Promise<void>;
    }
  >();
  private requestUnsubscribe: Unsubscribe | null = null;

  constructor(
    private readonly params: {
      eventBus: {
        subscribeAll: (
          handler: (event: { type: string; payload: unknown }) => void,
        ) => Unsubscribe;
      };
      extensionId: string;
      generation: string;
      transport: ExtensionTransportService;
    },
  ) {}

  readonly provide = (handlers: ExtensionObservationHandlers): Unsubscribe => {
    if (!handlers.read && !handlers.subscribe) {
      throw new Error("observations.provide requires read or subscribe.");
    }
    this.requestUnsubscribe?.();
    void this.closeAll();
    const unsubscribe = this.params.eventBus.subscribeAll((event) => {
      if (event.type !== "extension.request") return;
      const request = asRecord(event.payload);
      if (
        request.extensionId !== this.params.extensionId ||
        request.generation !== this.params.generation ||
        typeof request.requestId !== "string"
      )
        return;
      void this.handleRequest(request, handlers);
    });
    this.requestUnsubscribe = unsubscribe;
    return () => {
      if (this.requestUnsubscribe !== unsubscribe) return;
      this.requestUnsubscribe = null;
      unsubscribe();
      void this.closeAll();
    };
  };

  readonly close = async (): Promise<void> => {
    this.requestUnsubscribe?.();
    this.requestUnsubscribe = null;
    await this.closeAll();
  };

  private readonly handleRequest = async (
    request: Record<string, unknown>,
    handlers: ExtensionObservationHandlers,
  ): Promise<void> => {
    const requestId = requiredString(request.requestId, "requestId");
    try {
      const payload = asRecord(request.payload);
      let data: unknown;
      if (request.kind === "observation.read") {
        if (!handlers.read)
          throw new Error("Observation read is not provided.");
        const controller = new AbortController();
        data = await handlers.read({
          config: payload.config,
          signal: controller.signal,
        });
      } else if (request.kind === "observation.subscribe") {
        if (!handlers.subscribe)
          throw new Error("Observation events are not provided.");
        const subscriptionId = requiredString(
          payload.subscriptionId,
          "subscriptionId",
        );
        await this.replaceSubscription(
          subscriptionId,
          handlers.subscribe,
          payload,
        );
        data = { replay: handlers.replay ?? "unsupported" };
      } else if (request.kind === "observation.unsubscribe") {
        await this.closeSubscription(
          requiredString(payload.subscriptionId, "subscriptionId"),
        );
        data = { acknowledged: true };
      } else return;
      await this.params.transport.respondToRequest({
        requestId,
        ok: true,
        data,
      });
    } catch (error) {
      await this.params.transport.respondToRequest({
        requestId,
        ok: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  private readonly replaceSubscription = async (
    subscriptionId: string,
    subscribe: NonNullable<ExtensionObservationHandlers["subscribe"]>,
    payload: Record<string, unknown>,
  ): Promise<void> => {
    const existing = this.subscriptions.get(subscriptionId);
    if (existing) {
      await existing.ready;
      return;
    }
    const abort = new AbortController();
    const emit = async (
      event: ExtensionObservationEmitInput,
    ): Promise<void> => {
      await this.params.transport.postIngress(
        getKeyId(ingressKeys.extension.observationEvent),
        {
          subscriptionId,
          event: {
            eventId: requiredString(event.id, "event.id"),
            eventType: requiredString(event.type, "event.type"),
            occurredAt: requiredString(event.occurredAt, "event.occurredAt"),
            ...(event.observedAt ? { observedAt: event.observedAt } : {}),
            ...(event.cursor ? { cursor: event.cursor } : {}),
            ...(event.dedupeKey ? { dedupeKey: event.dedupeKey } : {}),
            payload: event.payload,
            ...(event.sourceRefs ? { sourceRefs: event.sourceRefs } : {}),
            ...(event.causationId ? { causationId: event.causationId } : {}),
            ...(event.correlationId
              ? { correlationId: event.correlationId }
              : {}),
          },
        },
      );
    };
    const subscription: {
      abort: AbortController;
      cleanup?: () => void | Promise<void>;
      ready: Promise<void>;
    } = {
      abort,
      ready: Promise.resolve(),
    };
    const ready = Promise.resolve(
      subscribe({
        subscriptionId,
        config: payload.config,
        ...(typeof payload.cursor === "string"
          ? { cursor: payload.cursor }
          : {}),
        emit,
        signal: abort.signal,
      }),
    ).then((cleanup) => {
      if (this.subscriptions.get(subscriptionId) === subscription && cleanup) {
        subscription.cleanup = cleanup;
      }
    });
    subscription.ready = ready;
    this.subscriptions.set(subscriptionId, subscription);
    try {
      await ready;
    } catch (error) {
      if (this.subscriptions.get(subscriptionId) === subscription) {
        this.subscriptions.delete(subscriptionId);
        abort.abort();
      }
      throw error;
    }
  };

  private readonly closeSubscription = async (
    subscriptionId: string,
    expected?: {
      abort: AbortController;
      cleanup?: () => void | Promise<void>;
      ready: Promise<void>;
    },
  ): Promise<void> => {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || (expected && subscription !== expected)) return;
    this.subscriptions.delete(subscriptionId);
    subscription.abort.abort();
    await subscription.ready.catch(() => undefined);
    await subscription.cleanup?.();
  };

  private readonly closeAll = async (): Promise<void> => {
    await Promise.all(
      [...this.subscriptions.entries()].map(([subscriptionId, subscription]) =>
        this.closeSubscription(subscriptionId, subscription),
      ),
    );
  };
}
