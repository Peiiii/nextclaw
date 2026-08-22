import type {
  ExtensionLease,
  ExtensionLifecycleService,
  ExtensionManifest,
} from "@kernel/features/extension-runtime/index.js";
import type {
  ObservationCapabilityDescriptor,
  ObservationEvent,
  ObservationExtensionRuntime,
} from "@kernel/features/observation/index.js";
import {
  readRecord,
  readRequiredString,
  readString,
} from "@kernel/features/extension-runtime/index.js";

export type ExtensionObservationRuntimeServiceOptions = {
  lifecycle: Pick<ExtensionLifecycleService, "acquire">;
  getEndpoint: () => string | null;
  getManifests: () => readonly ExtensionManifest[];
  findManifest: (extensionId: string) => ExtensionManifest;
  request: <T>(params: {
    extensionId: string;
    kind:
      | "observation.read"
      | "observation.subscribe"
      | "observation.unsubscribe";
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => Promise<T>;
  onEvent?: (input: {
    extensionId: string;
    subscriptionId: string;
    event: ObservationEvent;
  }) => Promise<{ accepted: boolean }>;
};

export class ExtensionObservationRuntimeService implements ObservationExtensionRuntime {
  private readonly leases = new Map<string, ExtensionLease>();
  private readonly inFlightSubscriptions = new Map<
    string,
    Promise<{ replay: "supported" | "unsupported" }>
  >();

  constructor(
    private readonly options: ExtensionObservationRuntimeServiceOptions,
  ) {}

  readonly discoverObservations: ObservationExtensionRuntime["discoverObservations"] =
    (input = {}) => {
      const query = input.query?.trim().toLocaleLowerCase();
      const kinds = input.kinds ? new Set(input.kinds) : null;
      const descriptors: ObservationCapabilityDescriptor[] = [];
      for (const manifest of this.options.getManifests()) {
        const observations = manifest.contributes?.observations;
        if (observations?.read) {
          descriptors.push({
            extensionId: manifest.id,
            kind: "context",
            title: manifest.name ?? manifest.id,
            description: observations.read.description,
            ...(observations.read.configSchema
              ? { configSchema: observations.read.configSchema }
              : {}),
          });
        }
        if (observations?.events) {
          descriptors.push({
            extensionId: manifest.id,
            kind: "events",
            title: manifest.name ?? manifest.id,
            description: observations.events.description,
            replay: observations.events.replay ?? "unsupported",
            ...(observations.events.configSchema
              ? { configSchema: observations.events.configSchema }
              : {}),
          });
        }
      }
      return descriptors.filter((descriptor) => {
        if (kinds && !kinds.has(descriptor.kind)) return false;
        if (!query) return true;
        return [
          descriptor.extensionId,
          descriptor.title,
          descriptor.description ?? "",
        ].some((value) => value.toLocaleLowerCase().includes(query));
      });
    };

  readonly readObservation: ObservationExtensionRuntime["readObservation"] =
    async ({ extensionId, config, signal }) => {
      this.requireCapability(extensionId, "read");
      return await this.options.request({
        extensionId,
        kind: "observation.read",
        payload: { config },
        signal,
      });
    };

  readonly subscribeObservation: ObservationExtensionRuntime["subscribeObservation"] =
    async (input) => {
      this.requireCapability(input.extensionId, "events");
      const key = this.leaseKey(input.extensionId, input.subscriptionId);
      const existing = this.inFlightSubscriptions.get(key);
      if (existing) return await existing;
      const operation = this.subscribeOnce(input).finally(() => {
        if (this.inFlightSubscriptions.get(key) === operation) {
          this.inFlightSubscriptions.delete(key);
        }
      });
      this.inFlightSubscriptions.set(key, operation);
      return await operation;
    };

  private subscribeOnce = async (
    input: Parameters<ObservationExtensionRuntime["subscribeObservation"]>[0],
  ): Promise<{ replay: "supported" | "unsupported" }> => {
    const lease = await this.ensureLease(
      input.extensionId,
      input.subscriptionId,
    );
    try {
      const result = await this.options.request<{ replay?: unknown }>({
        extensionId: input.extensionId,
        kind: "observation.subscribe",
        payload: {
          subscriptionId: input.subscriptionId,
          config: input.config,
          ...(input.cursor ? { cursor: input.cursor } : {}),
        },
      });
      return {
        replay: result.replay === "supported" ? "supported" : "unsupported",
      };
    } catch (error) {
      const key = this.leaseKey(input.extensionId, input.subscriptionId);
      if (this.leases.get(key) === lease) {
        this.leases.delete(key);
        lease.release();
      }
      throw error;
    }
  };

  readonly unsubscribeObservation: ObservationExtensionRuntime["unsubscribeObservation"] =
    async ({ extensionId, subscriptionId }) => {
      this.requireCapability(extensionId, "events");
      try {
        await this.options.request({
          extensionId,
          kind: "observation.unsubscribe",
          payload: { subscriptionId },
        });
      } finally {
        this.releaseLease(extensionId, subscriptionId);
      }
    };

  readonly handleEvent = async (input: {
    extensionId: string;
    payload: unknown;
  }): Promise<{ accepted: boolean }> => {
    const payload = readRecord(input.payload);
    const subscriptionId = readRequiredString(
      payload.subscriptionId,
      "subscriptionId",
    );
    const event = readRecord(payload.event);
    const eventId = readRequiredString(event.eventId, "event.eventId");
    const eventType = readRequiredString(event.eventType, "event.eventType");
    const occurredAt = readRequiredString(event.occurredAt, "event.occurredAt");
    return (
      (await this.options.onEvent?.({
        extensionId: input.extensionId,
        subscriptionId,
        event: {
          eventId,
          eventType,
          occurredAt,
          observedAt: readString(event.observedAt) ?? new Date().toISOString(),
          ...(readString(event.cursor)
            ? { cursor: readString(event.cursor) }
            : {}),
          ...(readString(event.dedupeKey)
            ? { dedupeKey: readString(event.dedupeKey) }
            : {}),
          payload: event.payload as never,
          ...(Array.isArray(event.sourceRefs) &&
          event.sourceRefs.every((value) => typeof value === "string")
            ? { sourceRefs: event.sourceRefs }
            : {}),
          ...(readString(event.causationId)
            ? { causationId: readString(event.causationId) }
            : {}),
          ...(readString(event.correlationId)
            ? { correlationId: readString(event.correlationId) }
            : {}),
        },
      })) ?? { accepted: false }
    );
  };

  readonly stop = (): void => {
    for (const lease of this.leases.values()) lease.release();
    this.leases.clear();
  };

  private requireCapability = (
    extensionId: string,
    capability: "read" | "events",
  ): void => {
    if (
      !this.options.findManifest(extensionId).contributes?.observations?.[
        capability
      ]
    ) {
      throw new Error(
        `Extension observation capability is not declared: ${extensionId}.${capability}`,
      );
    }
  };

  private ensureLease = async (
    extensionId: string,
    subscriptionId: string,
  ): Promise<ExtensionLease> => {
    const key = this.leaseKey(extensionId, subscriptionId);
    const existing = this.leases.get(key);
    if (existing) return existing;
    const endpoint = this.options.getEndpoint();
    if (!endpoint) throw new Error("Extension runtime is not started");
    const lease = await this.options.lifecycle.acquire(
      this.options.findManifest(extensionId),
      {
        endpoint,
        reason: { kind: "observation-subscription", subscriptionId },
      },
    );
    this.leases.set(key, lease);
    return lease;
  };

  private releaseLease = (
    extensionId: string,
    subscriptionId: string,
  ): void => {
    const key = this.leaseKey(extensionId, subscriptionId);
    const lease = this.leases.get(key);
    if (!lease) return;
    this.leases.delete(key);
    lease.release();
  };

  private leaseKey = (extensionId: string, subscriptionId: string): string =>
    `${extensionId}:${subscriptionId}`;
}
