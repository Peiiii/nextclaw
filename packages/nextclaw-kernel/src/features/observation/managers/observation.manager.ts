import { DEFAULT_AGENT_RUNTIME_ENTRY_ID } from "@kernel/configs/agent-runtime.config.js";
import { ObservationContextService } from "@kernel/features/observation/services/observation-context.service.js";
import { ObservationEventService } from "@kernel/features/observation/services/observation-event.service.js";
import { ObservationStore } from "@kernel/features/observation/stores/observation.store.js";
import type {
  BindContextInput,
  BuildContextTailInput,
  ContextBinding,
  EventDelivery,
  EventSubscription,
  ObservationCapabilityDescriptor,
  ObservationContextTail,
  ObservationEvent,
  ObservationExtensionRuntime,
  ObservationRef,
  SubscribeEventsInput,
} from "@kernel/features/observation/types/observation.types.js";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import { NcpEventType } from "@nextclaw/ncp";
import { eventKeys, type EventBus, type Ingress } from "@nextclaw/shared";

export type ObservationManagerOptions = {
  storePath: string;
  sessionManager: SessionManager;
  agentManager: AgentManager;
  ingress: Ingress;
  eventBus: EventBus;
  now?: () => Date;
};

export class ObservationManager {
  private readonly store: ObservationStore;
  private readonly context: ObservationContextService;
  private readonly events: ObservationEventService;
  private readonly cleanups: Array<() => void> = [];
  private runtime: ObservationExtensionRuntime | null = null;
  private started = false;

  constructor(private readonly options: ObservationManagerOptions) {
    this.store = new ObservationStore(options.storePath);
    const resolveTarget = this.resolveNativeTarget;
    this.context = new ObservationContextService({
      store: this.store,
      getRuntime: () => this.requireRuntime(),
      resolveTarget,
      now: options.now,
    });
    this.events = new ObservationEventService({
      store: this.store,
      sessionManager: options.sessionManager,
      ingress: options.ingress,
      getRuntime: () => this.requireRuntime(),
      resolveTarget,
      now: options.now,
    });
  }

  setExtensionRuntime = (runtime: ObservationExtensionRuntime): void => {
    this.runtime = runtime;
    if (this.started)
      this.runBackground(
        this.events.restore(),
        "restore extension observations",
      );
  };

  start = async (): Promise<void> => {
    if (this.started) return;
    this.started = true;
    await this.store.read();
    this.cleanups.push(
      this.options.eventBus.on(eventKeys.ncpEvent, (event) => {
        if (event.type === NcpEventType.MessageSent) {
          this.runBackground(
            this.events.markMaterialized(event.payload.message.id),
            "materialize event delivery",
          );
        }
      }),
      this.options.eventBus.on(
        eventKeys.sessionMetadataChanged,
        ({ sessionKey }) => {
          this.runBackground(
            this.revalidateSession(sessionKey),
            "revalidate session observations",
          );
        },
      ),
    );
    await this.events.start();
    await this.context.reconcile();
    await this.events.restore();
  };

  dispose = async (): Promise<void> => {
    this.started = false;
    while (this.cleanups.length > 0) this.cleanups.pop()?.();
    await this.events.dispose();
    await this.store.flush();
  };

  bindContext = async (input: BindContextInput): Promise<ContextBinding> => {
    this.requireCapability(input.extensionId, "context");
    return await this.context.bind(input);
  };

  subscribeEvents = async (
    input: SubscribeEventsInput,
  ): Promise<EventSubscription> => {
    this.requireCapability(input.extensionId, "events");
    return await this.events.subscribe(input);
  };

  acceptExtensionEvent = async (input: {
    extensionId: string;
    subscriptionId: string;
    event: ObservationEvent;
  }): Promise<{ accepted: boolean }> =>
    await this.events.acceptExtensionEvent(input);

  onExtensionObservationRuntimeExited = (extensionId: string): void =>
    this.events.onExtensionRuntimeExited(extensionId);

  onExtensionObservationRuntimeReady = async (
    extensionId: string,
  ): Promise<void> => await this.events.onExtensionRuntimeReady(extensionId);

  onDesktopObservationAuthorizationRevoked = async (input: {
    extensionId: string;
    subscriptionId: string;
  }): Promise<void> => await this.events.onCapabilityAuthorizationRevoked(input);

  onDesktopObservationAuthorizationGranted = async (input: {
    extensionId: string;
  }): Promise<void> => await this.events.onCapabilityAuthorizationGranted(input);

  buildContextTail = async (
    input: BuildContextTailInput,
  ): Promise<ObservationContextTail | undefined> =>
    await this.context.buildTail(input);

  discoverObservations = (
    input: { query?: string; kinds?: Array<"context" | "events"> } = {},
  ): ObservationCapabilityDescriptor[] =>
    this.requireRuntime().discoverObservations(input);

  listObservations = async (
    sessionId?: string,
  ): Promise<{
    bindings: ContextBinding[];
    subscriptions: EventSubscription[];
    deliveries: EventDelivery[];
  }> => {
    await this.context.expire();
    await this.events.expire();
    const state = await this.store.read();
    return {
      bindings: state.bindings.filter(
        (item) => !sessionId || item.target.sessionId === sessionId,
      ),
      subscriptions: state.subscriptions.filter(
        (item) => !sessionId || item.target.sessionId === sessionId,
      ),
      deliveries: state.deliveries.filter(
        (item) => !sessionId || item.targetSessionId === sessionId,
      ),
    };
  };

  getObservation = async (
    ref: ObservationRef,
  ): Promise<ContextBinding | EventSubscription | null> =>
    ref.kind === "context_binding"
      ? await this.context.get(ref.id)
      : await this.events.get(ref.id);

  updateObservation = async (
    action: "pause" | "resume" | "remove",
    ref: ObservationRef,
  ): Promise<{
    observation: ContextBinding | EventSubscription | null;
    remainingDeliveries: number;
  }> => {
    if (ref.kind === "event_subscription")
      return await this.events.update(action, ref.id);
    return {
      observation: await this.context.update(action, ref.id),
      remainingDeliveries: 0,
    };
  };

  removeSession = async (sessionId: string): Promise<void> => {
    await this.events.removeSession(sessionId);
    await this.context.removeSession(sessionId);
  };

  private revalidateSession = async (sessionId: string): Promise<void> => {
    await this.context.revalidateSession(sessionId);
    await this.events.revalidateSession(sessionId);
  };

  private resolveNativeTarget = async (
    sessionId: string,
  ): Promise<{ sessionId: string; agentId: string }> => {
    const normalizedSessionId = this.requireString(
      sessionId,
      "targetSessionId",
    );
    const session =
      await this.options.sessionManager.getAgentRunSession(normalizedSessionId);
    if (session.agentRuntimeId !== DEFAULT_AGENT_RUNTIME_ENTRY_ID)
      throw new Error("observation_runtime_unsupported");
    return {
      sessionId: session.sessionId,
      agentId: session.agentId ?? this.options.agentManager.getDefaultAgentId(),
    };
  };

  private requireCapability = (
    extensionId: string,
    kind: "context" | "events",
  ): void => {
    const normalizedExtensionId = this.requireString(
      extensionId,
      "extensionId",
    );
    const hasCapability = this.requireRuntime()
      .discoverObservations({ kinds: [kind] })
      .some((capability) => capability.extensionId === normalizedExtensionId);
    if (!hasCapability) {
      const capability = kind === "context" ? "read" : "events";
      throw new Error(
        `Extension observation capability is not declared: ${normalizedExtensionId}.${capability}`,
      );
    }
  };

  private requireRuntime = (): ObservationExtensionRuntime => {
    if (!this.runtime)
      throw new Error("Observation extension runtime is not initialized.");
    return this.runtime;
  };

  private requireString = (value: string, field: string): string => {
    const normalized = value.trim();
    if (!normalized) throw new Error(`${field} must be a non-empty string.`);
    return normalized;
  };

  private runBackground = (operation: Promise<void>, name: string): void => {
    void operation.catch((error) =>
      console.error(
        `[observation] failed to ${name}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  };
}
