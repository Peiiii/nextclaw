import { createHash } from "node:crypto";
import type { ObservationStore } from "@kernel/features/observation/stores/observation.store.js";
import type {
  EventDelivery,
  ObservationEvent,
} from "@kernel/features/observation/types/observation.types.js";
import {
  evaluateObservationEventAdmission,
  toBoundedJson,
} from "@kernel/features/observation/utils/observation.utils.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import {
  ingressKeys,
  type AgentRunSendIngressPayload,
  type Ingress,
} from "@nextclaw/shared";
import {
  OBSERVATION_EVENT_EXTENSION_TYPE,
  type NcpRunHandle,
} from "@nextclaw/ncp";

const MAX_EVENT_PAYLOAD_CHARS = 16_000;

export type ObservationDeliveryServiceOptions = {
  store: ObservationStore;
  sessionManager: SessionManager;
  ingress: Ingress;
  now?: () => Date;
};

export class ObservationDeliveryService {
  private readonly submissionPromises = new Map<string, Promise<void>>();

  constructor(private readonly options: ObservationDeliveryServiceOptions) {}

  dispose = (): void => this.submissionPromises.clear();

  deliver = async (
    subscriptionId: string,
    rawEvent: ObservationEvent,
  ): Promise<void> => {
    const event = this.normalizeEvent(rawEvent);
    const deliveryId = this.createDeliveryId(subscriptionId, event.eventId);
    const result = await this.options.store.mutate((state) => {
      const subscription = state.subscriptions.find(
        (item) => item.subscriptionId === subscriptionId,
      );
      if (!subscription || subscription.status !== "active") {
        return { deliveryId: null, shouldSubmit: false };
      }
      const decision = evaluateObservationEventAdmission({
        state,
        subscription,
        event,
        deliveryId,
        now: this.now(),
      });
      if (event.cursor) subscription.cursor = event.cursor;
      if (decision.kind === "admitted")
        state.deliveries.push(decision.delivery);
      if (decision.kind === "suppressed") {
        subscription.suppressedCount = (subscription.suppressedCount ?? 0) + 1;
        subscription.lastSuppressedAt = this.now().toISOString();
        subscription.lastSuppressionReason = decision.reason;
      }
      return {
        deliveryId:
          decision.kind === "admitted"
            ? decision.delivery.deliveryId
            : decision.kind === "existing"
              ? decision.deliveryId
              : null,
        shouldSubmit:
          decision.kind === "admitted" ||
          (decision.kind === "existing" &&
            state.deliveries.some(
              (item) =>
                item.deliveryId === decision.deliveryId &&
                item.status === "pending",
            )),
      };
    });
    if (result.deliveryId && result.shouldSubmit) {
      await this.submit(result.deliveryId);
    }
  };

  markMaterialized = async (messageId: string): Promise<void> => {
    const state = await this.options.store.read();
    if (
      !state.deliveries.some(
        (item) =>
          item.messageId === messageId && item.status !== "materialized",
      )
    ) {
      return;
    }
    await this.options.store.mutate((current) => {
      const delivery = current.deliveries.find(
        (item) => item.messageId === messageId,
      );
      if (!delivery) return;
      delivery.status = "materialized";
      delivery.updatedAt = this.now().toISOString();
      delete delivery.failure;
    });
  };

  reconcile = async (): Promise<void> => {
    const state = await this.options.store.read();
    for (const delivery of state.deliveries) {
      if (delivery.status !== "pending" && delivery.status !== "submitted")
        continue;
      await this.submit(delivery.deliveryId).catch(() => undefined);
    }
  };

  private submit = async (deliveryId: string): Promise<void> => {
    const existing = this.submissionPromises.get(deliveryId);
    if (existing) return await existing;
    const submission = this.submitOnce(deliveryId).finally(() => {
      this.submissionPromises.delete(deliveryId);
    });
    this.submissionPromises.set(deliveryId, submission);
    await submission;
  };

  private submitOnce = async (deliveryId: string): Promise<void> => {
    const delivery = (await this.options.store.read()).deliveries.find(
      (item) => item.deliveryId === deliveryId,
    );
    if (!delivery || delivery.status === "materialized") return;
    const record = await this.options.sessionManager.getSessionRecord(
      delivery.targetSessionId,
    );
    if (record?.messages.some((message) => message.id === delivery.messageId)) {
      await this.markMaterialized(delivery.messageId);
      return;
    }
    try {
      const accepted = await this.options.ingress.handle<
        AgentRunSendIngressPayload,
        NcpRunHandle
      >(
        {
          type: ingressKeys.agentRun.send,
          payload: await this.createIngressPayload(delivery),
          source: "observation",
        },
        { source: "observation" },
      );
      await this.options.store.mutate((state) => {
        const current = state.deliveries.find(
          (item) => item.deliveryId === deliveryId,
        );
        if (!current || current.status === "materialized") return;
        current.status = "submitted";
        current.resolvedDelivery = accepted.delivery ?? "queued";
        current.updatedAt = this.now().toISOString();
        delete current.failure;
      });
      const updated = await this.options.sessionManager.getSessionRecord(
        delivery.targetSessionId,
      );
      if (
        updated?.messages.some((message) => message.id === delivery.messageId)
      ) {
        await this.markMaterialized(delivery.messageId);
      }
    } catch (error) {
      await this.options.store.mutate((state) => {
        const current = state.deliveries.find(
          (item) => item.deliveryId === deliveryId,
        );
        if (!current) return;
        current.status = "pending";
        current.updatedAt = this.now().toISOString();
        current.failure = {
          code: "ingress_failed",
          message: error instanceof Error ? error.message : "ingress failed",
        };
      });
      throw error;
    }
  };

  private createIngressPayload = async (
    delivery: EventDelivery,
  ): Promise<AgentRunSendIngressPayload> => ({
    sessionId: delivery.targetSessionId,
    correlationId: delivery.ingressIdempotencyKey,
    delivery: delivery.requestedDelivery,
    idempotencyKey: delivery.ingressIdempotencyKey,
    message: {
      id: delivery.messageId,
      sessionId: delivery.targetSessionId,
      role: "service",
      status: "final",
      timestamp: delivery.event.observedAt,
      parts: [
        {
          type: "extension",
          extensionType: OBSERVATION_EVENT_EXTENSION_TYPE,
          data: {
            deliveryId: delivery.deliveryId,
            extensionId:
              (await this.options.store.read()).subscriptions.find(
                (item) => item.subscriptionId === delivery.subscriptionId,
              )?.extensionId ?? "unknown",
            eventId: delivery.event.eventId,
            eventType: delivery.event.eventType,
            occurredAt: delivery.event.occurredAt,
            payload: delivery.event.payload,
            ...(delivery.event.sourceRefs
              ? { sourceRefs: delivery.event.sourceRefs }
              : {}),
            ...(delivery.event.causationId
              ? { causationId: delivery.event.causationId }
              : {}),
          },
        },
      ],
      metadata: {
        observation_delivery_id: delivery.deliveryId,
        observation_subscription_id: delivery.subscriptionId,
      },
    },
  });

  private normalizeEvent = (event: ObservationEvent): ObservationEvent => {
    const eventId = this.requireString(event.eventId, "event.eventId");
    const eventType = this.requireString(event.eventType, "event.eventType");
    if (
      !Number.isFinite(Date.parse(event.occurredAt)) ||
      !Number.isFinite(Date.parse(event.observedAt))
    ) {
      throw new Error(
        "event.occurredAt and event.observedAt must be valid timestamps.",
      );
    }
    return {
      ...structuredClone(event),
      eventId,
      eventType,
      payload: toBoundedJson(event.payload, MAX_EVENT_PAYLOAD_CHARS),
    };
  };

  private createDeliveryId = (
    subscriptionId: string,
    eventId: string,
  ): string =>
    `event-delivery-${createHash("sha256")
      .update(`${subscriptionId}\0${eventId}`)
      .digest("hex")
      .slice(0, 32)}`;

  private requireString = (value: string, field: string): string => {
    const normalized = value.trim();
    if (!normalized) throw new Error(`${field} must be a non-empty string.`);
    return normalized;
  };

  private now = (): Date => this.options.now?.() ?? new Date();
}
