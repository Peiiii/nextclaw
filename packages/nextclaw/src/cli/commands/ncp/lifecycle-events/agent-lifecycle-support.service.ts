import {
  createGlobalTypedEventBus,
  type GlobalTypedEventBus,
  type SessionManager,
} from "@nextclaw/core";
import type { DefaultNcpAgentBackend } from "@nextclaw/ncp-toolkit";
import { LearningReviewFeature } from "../learning-review/index.js";
import type { SessionRequestBroker } from "../session-request/session-request-broker.service.js";
import { NcpLifecycleEventBridge } from "./ncp-lifecycle-event-bridge.service.js";

export class AgentLifecycleSupport {
  readonly globalEventBus: GlobalTypedEventBus;
  private readonly lifecycleEventBridge: NcpLifecycleEventBridge;
  private readonly learningReviewFeature: LearningReviewFeature;
  private unsubscribeEndpointEvents: (() => void) | null = null;

  constructor(params: {
    sessionManager: SessionManager;
    sessionRequestBroker: SessionRequestBroker;
    onSessionUpdated?: (sessionKey: string) => void;
    globalEventBus?: GlobalTypedEventBus;
  }) {
    const {
      sessionManager,
      sessionRequestBroker,
      onSessionUpdated,
      globalEventBus,
    } = params;
    this.globalEventBus =
      globalEventBus ??
      createGlobalTypedEventBus({
        onListenerError: ({ key, error }) => {
          console.warn(
            `[global-event-bus] listener failed for ${key}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        },
      });
    this.lifecycleEventBridge = new NcpLifecycleEventBridge(
      sessionManager,
      this.globalEventBus,
    );
    this.learningReviewFeature = new LearningReviewFeature({
      eventBus: this.globalEventBus,
      sessionStore: sessionManager,
      sessionRequester: sessionRequestBroker,
    });
    this.onSessionUpdated = onSessionUpdated;
  }

  private readonly onSessionUpdated?: (sessionKey: string) => void;

  handleSessionUpdated = (sessionKey: string): void => {
    this.onSessionUpdated?.(sessionKey);
    this.lifecycleEventBridge.publishSessionUpdated(sessionKey);
  };

  attachBackend = (backend: DefaultNcpAgentBackend): void => {
    this.unsubscribeEndpointEvents?.();
    this.unsubscribeEndpointEvents = backend.subscribe(
      this.lifecycleEventBridge.handleEndpointEvent,
    );
    this.learningReviewFeature.start();
  };

  dispose = (): void => {
    this.learningReviewFeature.dispose();
    this.unsubscribeEndpointEvents?.();
    this.unsubscribeEndpointEvents = null;
  };
}
