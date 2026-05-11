import type { NcpSessionApi } from "@nextclaw/ncp";
import {
  ContextCompactionPreflightService,
  UiSessionService,
} from "@nextclaw/kernel";
import { eventKeys, type Unsubscribe } from "@nextclaw/shared";
import {
  createDeferredUiNcpSessionService,
  type DeferredUiNcpSessionServiceController
} from "@nextclaw-service/shared/services/session/service-deferred-ncp-session-service.js";
import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";

function formatBackgroundTaskError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

export class ServiceNcpSessionRealtimeBridge {
  readonly sessionService: NcpSessionApi;
  readonly deferredSessionService: DeferredUiNcpSessionServiceController;
  readonly publishSessionChange: (sessionKey: string) => Promise<void>;
  private readonly unsubscribeSessionUpdated: Unsubscribe;

  constructor(gateway: NextclawGatewayRuntime) {
    let scheduleSessionChange = async (_sessionKey: string): Promise<void> => {};

    const contextWindowPreview = new ContextCompactionPreflightService({
      getConfig: gateway.configManager.loadConfig,
      sessionManager: gateway.sessionManager,
    });
    const persistedSessionService = new UiSessionService(gateway.sessionManager, {
      onSessionUpdated: (sessionKey) => {
        void scheduleSessionChange(sessionKey).catch((error) => {
          console.error(
            `[session-realtime] failed to publish session change for ${sessionKey}: ${formatBackgroundTaskError(error)}`
          );
        });
      },
      resolveContextWindow: ({ messages, metadata, sessionId }) =>
        contextWindowPreview.preview({
          contextWindowOwner: "nextclaw",
          requestMetadata: metadata,
          sessionId,
          sessionMessages: messages,
        }),
    });
    const deferredSessionService = createDeferredUiNcpSessionService(persistedSessionService);

    const publishLatestSessionChange = async (sessionKey: string): Promise<void> => {
      const normalizedSessionKey = sessionKey.trim();
      if (!normalizedSessionKey) {
        return;
      }
      const summary = await deferredSessionService.service.getSession(normalizedSessionKey);
      gateway.appEventBus.emitEnvelope(summary
        ? { type: "session.summary.upsert", payload: { summary } }
        : { type: "session.summary.delete", payload: { sessionKey: normalizedSessionKey } });
    };
    scheduleSessionChange = publishLatestSessionChange;
    this.unsubscribeSessionUpdated = gateway.appEventBus.on(eventKeys.sessionUpdated, ({ sessionKey }) => {
      void scheduleSessionChange(sessionKey).catch((error) => {
        console.error(
          `[session-realtime] failed to publish session change for ${sessionKey}: ${formatBackgroundTaskError(error)}`
        );
      });
    });
    this.sessionService = deferredSessionService.service;
    this.deferredSessionService = deferredSessionService;
    this.publishSessionChange = scheduleSessionChange;
  }

  clear = (): void => {
    this.deferredSessionService.clear();
    this.unsubscribeSessionUpdated();
  };
}
