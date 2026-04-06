import type { SessionManager } from "@nextclaw/core";
import type { NcpSessionApi } from "@nextclaw/ncp";
import type { UiServerEvent } from "@nextclaw/server";
import { createNcpSessionRealtimeChangePublisher } from "../../ncp/session/ncp-session-realtime-change.js";
import { UiSessionService } from "../../ncp/ui-session-service.js";
import {
  createDeferredUiNcpSessionService,
  type DeferredUiNcpSessionServiceController
} from "./service-deferred-ncp-session-service.js";

type PublishUiEvent = ((event: UiServerEvent) => void) | undefined;

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

export type ServiceNcpSessionRealtimeBridge = {
  sessionService: NcpSessionApi;
  deferredSessionService: DeferredUiNcpSessionServiceController;
  publishSessionChange: (sessionKey: string) => Promise<void>;
  setUiEventPublisher: (publishUiEvent: PublishUiEvent) => void;
  clear: () => void;
};

export function createServiceNcpSessionRealtimeBridge(params: {
  sessionManager: SessionManager;
  publishUiEvent?: PublishUiEvent;
}): ServiceNcpSessionRealtimeBridge {
  let publishUiEvent = params.publishUiEvent;
  let publishSessionChange = async (_sessionKey: string): Promise<void> => {};
  let scheduleSessionChange = async (_sessionKey: string): Promise<void> => {};

  const persistedSessionService = new UiSessionService(params.sessionManager, {
    onSessionUpdated: (sessionKey) => {
      void scheduleSessionChange(sessionKey);
    }
  });
  const deferredSessionService = createDeferredUiNcpSessionService(persistedSessionService);

  const publishLatestSessionChange = async (sessionKey: string) => {
    await createNcpSessionRealtimeChangePublisher({
      sessionApi: deferredSessionService.service,
      publishUiEvent
    }).publishSessionChange(sessionKey);
  };
  scheduleSessionChange = createLatestOnlySessionChangePublisher(publishLatestSessionChange);
  publishSessionChange = scheduleSessionChange;

  return {
    sessionService: deferredSessionService.service,
    deferredSessionService,
    publishSessionChange,
    setUiEventPublisher: (nextPublishUiEvent) => {
      publishUiEvent = nextPublishUiEvent;
    },
    clear: () => {
      deferredSessionService.clear();
    },
  };
}
