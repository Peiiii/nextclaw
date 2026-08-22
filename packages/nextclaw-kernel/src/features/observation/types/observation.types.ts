import type {
  NcpContextTail,
  NcpJsonValue,
  NcpResolvedInputDelivery,
} from "@nextclaw/ncp";

export type JsonValue = NcpJsonValue;

export type ObservationCapabilityDescriptor = {
  extensionId: string;
  kind: "context" | "events";
  title: string;
  description?: string;
  configSchema?: Record<string, unknown>;
  replay?: "supported" | "unsupported";
};

export type ObservationTarget = {
  sessionId: string;
  agentId: string;
};

export type ObservationEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  observedAt: string;
  cursor?: string;
  dedupeKey?: string;
  causationId?: string;
  correlationId?: string;
  payload: JsonValue;
  sourceRefs?: string[];
};

export type ObservationRelationshipStatus =
  | "active"
  | "paused"
  | "degraded"
  | "expired"
  | "broken";

export type ContextBinding = {
  bindingId: string;
  extensionId: string;
  config: JsonValue;
  target: ObservationTarget;
  projection: { maxChars?: number; maxItems?: number };
  status: ObservationRelationshipStatus;
  statusReason?: string;
  createdAt: string;
  expiresAt?: string;
  lastReadAt?: string;
};

export type JsonPointer = string;

export type TypedPredicate =
  | { op: "exists"; path: JsonPointer }
  | {
      op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
      path: JsonPointer;
      value: JsonValue;
    }
  | { op: "and"; args: TypedPredicate[] }
  | { op: "or"; args: TypedPredicate[] }
  | { op: "not"; arg: TypedPredicate };

export type EventAdmissionPolicy = {
  predicate?: TypedPredicate;
  dedupe?: { key: JsonPointer; window?: string };
};

export type EventSubscriptionBudget = {
  maxPending: number;
  maxDeliveriesPerWindow?: number;
  window?: string;
};

export type EventSubscription = {
  subscriptionId: string;
  extensionId: string;
  config: JsonValue;
  target: ObservationTarget;
  admission: EventAdmissionPolicy;
  delivery: "queue" | "prefer-steer";
  budget: EventSubscriptionBudget;
  cursor?: string;
  status: ObservationRelationshipStatus;
  statusReason?: string;
  createdAt: string;
  expiresAt?: string;
  suppressedCount?: number;
  lastSuppressedAt?: string;
  lastSuppressionReason?: "predicate" | "dedupe" | "max_pending" | "rate_limit";
  lastGapAt?: string;
  gapReason?: "replay_unsupported";
};

export type EventDelivery = {
  deliveryId: string;
  subscriptionId: string;
  eventId: string;
  event: ObservationEvent;
  dedupeValue?: string;
  targetSessionId: string;
  requestedDelivery: "queue" | "prefer-steer";
  resolvedDelivery?: NcpResolvedInputDelivery;
  status: "pending" | "submitted" | "materialized" | "failed";
  ingressIdempotencyKey: string;
  messageId: string;
  createdAt: string;
  updatedAt: string;
  failure?: { code: string; message: string };
};

export type ObservationState = {
  bindings: ContextBinding[];
  subscriptions: EventSubscription[];
  deliveries: EventDelivery[];
};

export type ObservationRef =
  | { kind: "context_binding"; id: string }
  | { kind: "event_subscription"; id: string };

export type BindContextInput = {
  extensionId: string;
  config: JsonValue;
  targetSessionId: string;
  projection?: { maxChars?: number; maxItems?: number };
  ttl?: string;
};

export type SubscribeEventsInput = {
  extensionId: string;
  config: JsonValue;
  targetSessionId: string;
  admission?: EventAdmissionPolicy;
  delivery?: "queue" | "prefer-steer";
  budget?: Partial<EventSubscriptionBudget>;
  ttl?: string;
};

export type BuildContextTailInput = {
  sessionId: string;
  signal?: AbortSignal;
};

export type ObservationContextTail = NcpContextTail;

export type ObservationExtensionRuntime = {
  discoverObservations: (input?: {
    query?: string;
    kinds?: Array<"context" | "events">;
  }) => ObservationCapabilityDescriptor[];
  readObservation: (input: {
    extensionId: string;
    config: JsonValue;
    signal?: AbortSignal;
  }) => Promise<JsonValue>;
  subscribeObservation: (input: {
    extensionId: string;
    subscriptionId: string;
    config: JsonValue;
    cursor?: string;
  }) => Promise<{ replay: "supported" | "unsupported" }>;
  unsubscribeObservation: (input: {
    extensionId: string;
    subscriptionId: string;
  }) => Promise<void>;
};
