import type { NcpSessionApi } from "@nextclaw/ncp";

export type DeferredUiNcpSessionServiceController = {
  service: NcpSessionApi;
  activate: (service: NcpSessionApi) => void;
  clear: () => void;
  isReady: () => boolean;
};

export function createDeferredUiNcpSessionService(fallbackService: NcpSessionApi): DeferredUiNcpSessionServiceController {
  let activeService: NcpSessionApi | null = null;

  const resolveService = (): NcpSessionApi => activeService ?? fallbackService;

  const service: NcpSessionApi = {
    listSessions: (options) => resolveService().listSessions(options),
    listSessionMessages: (sessionId, options) => resolveService().listSessionMessages(sessionId, options),
    getSession: (sessionId) => resolveService().getSession(sessionId),
    updateSession: (sessionId, patch) => resolveService().updateSession(sessionId, patch),
    deleteSession: (sessionId) => resolveService().deleteSession(sessionId),
  };

  return {
    service,
    activate(nextService) {
      activeService = nextService;
    },
    clear() {
      activeService = null;
    },
    isReady() {
      return activeService !== null;
    },
  };
}
