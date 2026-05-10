import type { NcpSessionApi } from "@nextclaw/ncp";
import { ContextCompactionPreflightService } from "@nextclaw-service/commands/ncp/context/context-compaction-preflight.service.js";
import { createNcpSessionRealtimeChangePublisher } from "@nextclaw-service/commands/ncp/session/ncp-session-realtime-change.utils.js";
import { UiSessionService } from "@nextclaw-service/commands/ncp/ui-session-service.js";
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

export function createLatestOnlySessionChangePublisher(
  publishSessionChange: (sessionKey: string) => Promise<void>,
): (sessionKey: string) => Promise<void> {
  const inFlightTasks = new Map<string, Promise<void>>();
  const rerunKeys = new Set<string>();

  const flushSessionChange = async (sessionKey: string): Promise<void> => {
    do {
      rerunKeys.delete(sessionKey);
      await publishSessionChange(sessionKey);
    } while (rerunKeys.has(sessionKey));
  };

  return async (sessionKey: string): Promise<void> => {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey) {
      return;
    }

    const activeTask = inFlightTasks.get(normalizedSessionKey);
    if (activeTask) {
      rerunKeys.add(normalizedSessionKey);
      await activeTask;
      return;
    }

    const task = flushSessionChange(normalizedSessionKey).finally(() => {
      if (inFlightTasks.get(normalizedSessionKey) === task) {
        inFlightTasks.delete(normalizedSessionKey);
      }
    });
    inFlightTasks.set(normalizedSessionKey, task);
    await task;
  };
}

export class ServiceNcpSessionRealtimeBridge {
  readonly sessionService: NcpSessionApi;
  readonly deferredSessionService: DeferredUiNcpSessionServiceController;
  readonly publishSessionChange: (sessionKey: string) => Promise<void>;

  constructor(gateway: NextclawGatewayRuntime) {
    let scheduleSessionChange = async (_sessionKey: string): Promise<void> => {};

    const contextWindowPreview = new ContextCompactionPreflightService({
      getConfig: gateway.configManager.loadGatewayConfig,
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

    const publishLatestSessionChange = async (sessionKey: string) => {
      await createNcpSessionRealtimeChangePublisher({
        sessionApi: deferredSessionService.service,
        appEventBus: gateway.appEventBus
      }).publishSessionChange(sessionKey);
    };
    scheduleSessionChange = createLatestOnlySessionChangePublisher(publishLatestSessionChange);
    this.sessionService = deferredSessionService.service;
    this.deferredSessionService = deferredSessionService;
    this.publishSessionChange = scheduleSessionChange;
  }

  clear = (): void => {
    this.deferredSessionService.clear();
  };
}
