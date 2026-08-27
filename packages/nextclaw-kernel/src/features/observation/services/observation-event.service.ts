import { randomUUID } from "node:crypto";
import { ObservationDeliveryService } from "@kernel/features/observation/services/observation-delivery.service.js";
import type { ObservationStore } from "@kernel/features/observation/stores/observation.store.js";
import type {
  EventSubscription,
  ObservationEvent,
  ObservationExtensionRuntime,
  SubscribeEventsInput,
} from "@kernel/features/observation/types/observation.types.js";
import {
  assertObservationPredicate,
  parseObservationDuration,
  readJsonPointer,
} from "@kernel/features/observation/utils/observation.utils.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { Ingress } from "@nextclaw/shared";

const DEFAULT_RELATIONSHIP_TTL = "P30D";
const DEFAULT_BUDGET_WINDOW = "PT1H";

type RuntimeSubscription = Pick<
  EventSubscription,
  "extensionId" | "subscriptionId"
>;

export type ObservationEventServiceOptions = {
  store: ObservationStore;
  sessionManager: SessionManager;
  ingress: Ingress;
  getRuntime: () => ObservationExtensionRuntime;
  resolveTarget: (
    sessionId: string,
  ) => Promise<{ sessionId: string; agentId: string }>;
  now?: () => Date;
};

export class ObservationEventService {
  private readonly delivery: ObservationDeliveryService;
  private readonly activationPromises = new Map<string, Promise<void>>();
  private readonly activeSubscriptions = new Map<string, string>();
  private started = false;

  constructor(private readonly options: ObservationEventServiceOptions) {
    this.delivery = new ObservationDeliveryService(options);
  }

  start = async (): Promise<void> => {
    if (this.started) return;
    this.started = true;
    await this.delivery.reconcile();
  };

  dispose = async (): Promise<void> => {
    this.started = false;
    await Promise.all(
      [...this.activeSubscriptions.entries()].map(
        ([subscriptionId, extensionId]) =>
          this.deactivateStored({ subscriptionId, extensionId }),
      ),
    );
    this.activationPromises.clear();
    this.delivery.dispose();
    await this.options.store.flush();
  };

  subscribe = async (
    input: SubscribeEventsInput,
  ): Promise<EventSubscription> => {
    const extensionId = this.required(input.extensionId, "extensionId");
    const target = await this.options.resolveTarget(input.targetSessionId);
    const budget = {
      maxPending: input.budget?.maxPending ?? 10,
      maxDeliveriesPerWindow: input.budget?.maxDeliveriesPerWindow ?? 20,
      window: input.budget?.window ?? DEFAULT_BUDGET_WINDOW,
    };
    this.assertBudget(budget);
    if (input.admission?.dedupe?.window) {
      parseObservationDuration(
        input.admission.dedupe.window,
        "admission.dedupe.window",
      );
    }
    if (input.admission?.predicate)
      assertObservationPredicate(input.admission.predicate);
    if (input.admission?.dedupe)
      readJsonPointer({}, input.admission.dedupe.key);
    const expiresAt = new Date(
      this.nowMs() +
        parseObservationDuration(input.ttl ?? DEFAULT_RELATIONSHIP_TTL, "ttl"),
    ).toISOString();
    const subscription = await this.options.store.mutate((state) => {
      const found = state.subscriptions.find(
        (item) =>
          item.extensionId === extensionId &&
          JSON.stringify(item.config) === JSON.stringify(input.config) &&
          item.target.sessionId === target.sessionId &&
          item.status !== "expired",
      );
      if (found) return structuredClone(found);
      const created: EventSubscription = {
        subscriptionId: `event-subscription-${randomUUID()}`,
        extensionId,
        config: structuredClone(input.config),
        target,
        admission: structuredClone(input.admission ?? {}),
        delivery: input.delivery ?? "queue",
        budget,
        status: "active",
        createdAt: this.now().toISOString(),
        expiresAt,
      };
      state.subscriptions.push(created);
      return structuredClone(created);
    });
    await this.activate(subscription.subscriptionId);
    const active =
      (await this.get(subscription.subscriptionId)) ?? subscription;
    if (active.status !== "active") {
      throw new Error(active.statusReason ?? "observation_subscription_failed");
    }
    return active;
  };

  acceptExtensionEvent = async (input: {
    extensionId: string;
    subscriptionId: string;
    event: ObservationEvent;
  }): Promise<{ accepted: boolean }> => {
    const subscription = await this.get(input.subscriptionId);
    if (
      !subscription ||
      subscription.extensionId !== input.extensionId ||
      subscription.status !== "active"
    ) {
      return { accepted: false };
    }
    await this.delivery.deliver(input.subscriptionId, input.event);
    return { accepted: true };
  };

  update = async (
    action: "pause" | "resume" | "remove",
    subscriptionId: string,
  ): Promise<{
    observation: EventSubscription | null;
    remainingDeliveries: number;
  }> => {
    const existing = await this.get(subscriptionId);
    const result = await this.options.store.mutate((state) => {
      const index = state.subscriptions.findIndex(
        (item) => item.subscriptionId === subscriptionId,
      );
      if (index < 0) return { observation: null, remainingDeliveries: 0 };
      if (action === "remove") {
        state.subscriptions.splice(index, 1);
        this.failPending(state.deliveries, subscriptionId);
        return {
          observation: null,
          remainingDeliveries: state.deliveries.filter(
            (item) => item.subscriptionId === subscriptionId,
          ).length,
        };
      }
      const item = state.subscriptions[index];
      item.status = action === "pause" ? "paused" : "active";
      delete item.statusReason;
      return {
        observation: structuredClone(item),
        remainingDeliveries: state.deliveries.filter(
          (item) => item.subscriptionId === subscriptionId,
        ).length,
      };
    });
    if ((action === "pause" || action === "remove") && existing) {
      await this.deactivateStored(existing);
    }
    if (action === "resume") {
      await this.activate(subscriptionId);
      result.observation = await this.get(subscriptionId);
    }
    return result;
  };

  get = async (subscriptionId: string): Promise<EventSubscription | null> => {
    const item = (await this.options.store.read()).subscriptions.find(
      (candidate) => candidate.subscriptionId === subscriptionId,
    );
    return item ? structuredClone(item) : null;
  };

  restore = async (): Promise<void> => {
    await this.expire();
    await Promise.all(
      (await this.options.store.read()).subscriptions
        .filter(
          (item) => item.status === "active" || item.status === "degraded",
        )
        .map((item) => this.activate(item.subscriptionId)),
    );
  };

  markMaterialized = async (messageId: string): Promise<void> =>
    await this.delivery.markMaterialized(messageId);

  onExtensionRuntimeExited = (extensionId: string): void => {
    for (const [subscriptionId, activeExtensionId] of this
      .activeSubscriptions) {
      if (activeExtensionId === extensionId) {
        this.activeSubscriptions.delete(subscriptionId);
      }
    }
  };

  onExtensionRuntimeReady = async (extensionId: string): Promise<void> => {
    const subscriptions = (
      await this.options.store.read()
    ).subscriptions.filter(
      (item) =>
        item.extensionId === extensionId &&
        (item.status === "active" || item.status === "degraded"),
    );
    await Promise.all(
      subscriptions.map((item) => this.activate(item.subscriptionId)),
    );
  };

  onCapabilityAuthorizationRevoked = async (input: {
    extensionId: string;
    subscriptionId: string;
  }): Promise<void> => {
    const subscription = await this.get(input.subscriptionId);
    if (!subscription || subscription.extensionId !== input.extensionId) return;
    await this.deactivateStored(subscription);
    await this.setStatus(input.subscriptionId, "degraded", "authorization_required");
  };

  onCapabilityAuthorizationGranted = async (input: {
    extensionId: string;
  }): Promise<void> => {
    const subscriptions = (await this.options.store.read()).subscriptions.filter(
      (subscription) =>
        subscription.extensionId === input.extensionId &&
        subscription.status === "degraded" &&
        subscription.statusReason === "authorization_required",
    );
    await Promise.all(
      subscriptions.map((subscription) => this.activate(subscription.subscriptionId)),
    );
  };

  revalidateSession = async (sessionId: string): Promise<void> => {
    const items = (await this.options.store.read()).subscriptions.filter(
      (item) =>
        item.target.sessionId === sessionId &&
        item.status !== "paused" &&
        item.status !== "expired",
    );
    try {
      const target = await this.options.resolveTarget(sessionId);
      if (items.some((item) => item.target.agentId !== target.agentId)) {
        throw new Error("target_agent_changed");
      }
    } catch (error) {
      await Promise.all(items.map((item) => this.deactivateStored(item)));
      await this.options.store.mutate((state) => {
        for (const item of state.subscriptions) {
          if (
            item.target.sessionId === sessionId &&
            item.status !== "paused" &&
            item.status !== "expired"
          ) {
            item.status = "broken";
            item.statusReason = this.message(error);
          }
        }
      });
    }
  };

  removeSession = async (sessionId: string): Promise<void> => {
    const items = (await this.options.store.read()).subscriptions.filter(
      (item) => item.target.sessionId === sessionId,
    );
    await Promise.all(items.map((item) => this.deactivateStored(item)));
    await this.options.store.mutate((state) => {
      state.subscriptions = state.subscriptions.filter(
        (item) => item.target.sessionId !== sessionId,
      );
      state.deliveries = state.deliveries.filter(
        (item) => item.targetSessionId !== sessionId,
      );
    });
  };

  expire = async (): Promise<void> => {
    const expired = (await this.options.store.read()).subscriptions.filter(
      (item) =>
        item.expiresAt &&
        Date.parse(item.expiresAt) <= this.nowMs() &&
        item.status !== "expired",
    );
    await Promise.all(expired.map((item) => this.deactivateStored(item)));
    if (expired.length > 0) {
      await this.options.store.mutate((state) => {
        for (const item of state.subscriptions) {
          if (item.expiresAt && Date.parse(item.expiresAt) <= this.nowMs()) {
            item.status = "expired";
          }
        }
      });
    }
  };

  private activate = async (subscriptionId: string): Promise<void> => {
    if (!this.started || this.activeSubscriptions.has(subscriptionId)) return;
    const existing = this.activationPromises.get(subscriptionId);
    if (existing) return await existing;
    const operation = this.activateOnce(subscriptionId).finally(() => {
      this.activationPromises.delete(subscriptionId);
    });
    this.activationPromises.set(subscriptionId, operation);
    await operation;
  };

  private activateOnce = async (subscriptionId: string): Promise<void> => {
    const subscription = await this.get(subscriptionId);
    if (
      !subscription ||
      subscription.status === "paused" ||
      subscription.status === "expired"
    ) {
      return;
    }
    try {
      const target = await this.options.resolveTarget(
        subscription.target.sessionId,
      );
      if (target.agentId !== subscription.target.agentId) {
        throw new Error("target_agent_changed");
      }
      const result = await this.options.getRuntime().subscribeObservation({
        extensionId: subscription.extensionId,
        subscriptionId,
        config: subscription.config,
        ...(subscription.cursor ? { cursor: subscription.cursor } : {}),
      });
      if (subscription.cursor && result.replay === "unsupported") {
        await this.options.store.mutate((state) => {
          const current = state.subscriptions.find(
            (item) => item.subscriptionId === subscriptionId,
          );
          if (current) {
            current.lastGapAt = this.now().toISOString();
            current.gapReason = "replay_unsupported";
          }
        });
      }
      this.activeSubscriptions.set(subscriptionId, subscription.extensionId);
      await this.setStatus(subscriptionId, "active");
    } catch (error) {
      await this.setStatus(subscriptionId, "degraded", this.message(error));
    }
  };

  private deactivate = async (subscriptionId: string): Promise<void> => {
    const subscription = await this.get(subscriptionId);
    if (subscription) await this.deactivateStored(subscription);
  };

  private deactivateStored = async (
    subscription: RuntimeSubscription,
  ): Promise<void> => {
    this.activeSubscriptions.delete(subscription.subscriptionId);
    await this.options
      .getRuntime()
      .unsubscribeObservation({
        extensionId: subscription.extensionId,
        subscriptionId: subscription.subscriptionId,
      })
      .catch(() => undefined);
  };

  private setStatus = async (
    subscriptionId: string,
    status: EventSubscription["status"],
    reason?: string,
  ): Promise<void> =>
    await this.options.store.mutate((state) => {
      const item = state.subscriptions.find(
        (candidate) => candidate.subscriptionId === subscriptionId,
      );
      if (!item || item.status === "paused" || item.status === "expired")
        return;
      item.status = status;
      if (reason) item.statusReason = reason;
      else delete item.statusReason;
    });

  private failPending = (
    deliveries: Awaited<ReturnType<ObservationStore["read"]>>["deliveries"],
    subscriptionId: string,
  ): void => {
    for (const item of deliveries) {
      if (item.subscriptionId === subscriptionId && item.status === "pending") {
        item.status = "failed";
        item.failure = {
          code: "subscription_removed",
          message: "Subscription removed before ingress.",
        };
        item.updatedAt = this.now().toISOString();
      }
    }
  };

  private assertBudget = (budget: EventSubscription["budget"]): void => {
    if (!Number.isInteger(budget.maxPending) || budget.maxPending <= 0) {
      throw new Error("budget.maxPending must be a positive integer.");
    }
    if (
      !Number.isInteger(budget.maxDeliveriesPerWindow) ||
      (budget.maxDeliveriesPerWindow ?? 0) <= 0
    ) {
      throw new Error(
        "budget.maxDeliveriesPerWindow must be a positive integer.",
      );
    }
    parseObservationDuration(
      budget.window ?? DEFAULT_BUDGET_WINDOW,
      "budget.window",
    );
  };

  private required = (value: string, field: string): string => {
    const normalized = value.trim();
    if (!normalized) throw new Error(`${field} must be a non-empty string.`);
    return normalized;
  };

  private message = (error: unknown): string =>
    error instanceof Error ? error.message : "observation_subscription_failed";

  private now = (): Date => this.options.now?.() ?? new Date();
  private nowMs = (): number => this.now().getTime();
}
