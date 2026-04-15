import {
  createGlobalTypedEventBus,
  type GlobalTypedEventBus,
  type SessionManager,
} from "@nextclaw/core";
import type { DefaultNcpAgentBackend } from "@nextclaw/ncp-toolkit";
import type { SessionRequestBroker } from "../ncp/session-request/session-request-broker.service.js";
import { NcpLifecycleEventBridge } from "../ncp/lifecycle-events/ncp-lifecycle-event-bridge.service.js";
import { LearningLoopFeature } from "./learning-loop-feature.service.js";
import type { LearningLoopRuntimeConfig } from "./learning-loop.config.js";

export class LearningLoopRuntimeService {
  readonly globalEventBus: GlobalTypedEventBus;
  private readonly lifecycleEventBridge: NcpLifecycleEventBridge;
  private readonly learningLoopFeature: LearningLoopFeature;
  private unsubscribeEndpointEvents: (() => void) | null = null;

  constructor(params: {
    sessionManager: SessionManager;
    sessionRequestBroker: SessionRequestBroker;
    onSessionUpdated?: (sessionKey: string) => void;
    globalEventBus?: GlobalTypedEventBus;
    resolveLearningLoopConfig?: () => LearningLoopRuntimeConfig;
  }) {
    const {
      sessionManager,
      sessionRequestBroker,
      onSessionUpdated,
      globalEventBus,
      resolveLearningLoopConfig,
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
    this.learningLoopFeature = new LearningLoopFeature({
      eventBus: this.globalEventBus,
      sessionStore: sessionManager,
      sessionRequester: sessionRequestBroker,
      resolveRuntimeConfig: resolveLearningLoopConfig,
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
    this.learningLoopFeature.start();
  };

  dispose = (): void => {
    this.learningLoopFeature.dispose();
    this.unsubscribeEndpointEvents?.();
    this.unsubscribeEndpointEvents = null;
  };
}
