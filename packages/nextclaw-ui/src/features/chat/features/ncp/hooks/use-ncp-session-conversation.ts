import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NcpHttpAgentClientEndpoint } from "@nextclaw/ncp-http-agent-client";
import { useHydratedNcpAgent } from "@nextclaw/ncp-react";
import { API_BASE } from "@/shared/lib/api";
import { createNcpAppClientFetch } from "@/features/chat/features/runtime/utils/ncp-app-client-fetch.utils";
import {
  DEFAULT_NCP_SESSION_MESSAGE_LIMIT,
  useNcpSessionMessageHistory,
} from "@/features/chat/features/ncp/hooks/use-ncp-session-message-history";
import { useSystemStatus } from "@/features/system-status";

const NCP_AGENT_UNAVAILABLE_DURING_STARTUP =
  "ncp agent unavailable during startup";

export { fetchNcpSessionConversationSeed } from "@/features/chat/features/ncp/hooks/use-ncp-session-message-history";

type UseNcpSessionConversationOptions = {
  messageLimit?: number;
};

export function isNcpAgentStartupUnavailableErrorMessage(
  message: string | null | undefined,
): boolean {
  return (
    message
      ?.trim()
      .toLowerCase()
      .includes(NCP_AGENT_UNAVAILABLE_DURING_STARTUP) ?? false
  );
}

export function createNcpSessionConversationClient(): NcpHttpAgentClientEndpoint {
  return new NcpHttpAgentClientEndpoint({
    baseUrl: API_BASE,
    basePath: "/api/ncp/agent",
    fetchImpl: createNcpAppClientFetch(),
  });
}

function useSyncReadyRetryVersion(
  readyRetrySignature: string | null,
  bumpRetryVersion: () => void,
): void {
  const retriedReadySignatureRef = useRef<string | null>(null);
  const syncReadyRetryVersion = useCallback(
    (nextSignature: string | null) => {
      if (!nextSignature) {
        retriedReadySignatureRef.current = null;
        return;
      }
      if (retriedReadySignatureRef.current === nextSignature) {
        return;
      }
      retriedReadySignatureRef.current = nextSignature;
      bumpRetryVersion();
    },
    [bumpRetryVersion],
  );

  useEffect(() => {
    syncReadyRetryVersion(readyRetrySignature);
  }, [readyRetrySignature, syncReadyRetryVersion]);
}

export function useNcpSessionConversation(
  sessionId: string | undefined,
  options: UseNcpSessionConversationOptions = {},
) {
  const [client] = useState(() => createNcpSessionConversationClient());
  const systemStatus = useSystemStatus();
  const [hydrationRetryVersion, setHydrationRetryVersion] = useState(0);
  const {
    loadSeed,
    loadPreviousMessages: loadPreviousHistory,
    state: visibleHistoryState,
  } = useNcpSessionMessageHistory({
    sessionId,
    messageLimit: options.messageLimit ?? DEFAULT_NCP_SESSION_MESSAGE_LIMIT,
    hydrationRetryVersion,
  });
  const agent = useHydratedNcpAgent({
    sessionId,
    client,
    loadSeed,
  });
  const loadPreviousMessages = useCallback(
    async (): Promise<void> =>
      await loadPreviousHistory(agent.prependHistory),
    [agent.prependHistory, loadPreviousHistory],
  );
  const currentAgentError =
    agent.hydrateError?.message ?? agent.snapshot.error?.message ?? null;
  const readyRetrySignature =
    sessionId &&
    systemStatus.phase === "ready" &&
    isNcpAgentStartupUnavailableErrorMessage(currentAgentError)
      ? `${sessionId}:${systemStatus.lastReadyAt ?? 0}`
      : null;
  useSyncReadyRetryVersion(readyRetrySignature, () => {
    setHydrationRetryVersion((current) => current + 1);
  });
  return useMemo(
    () => ({
      ...agent,
      snapshot: {
        ...agent.snapshot,
        contextWindow:
          agent.snapshot.contextWindow ?? visibleHistoryState.contextWindow,
      },
      hasPreviousMessages: visibleHistoryState.hasPreviousPage,
      historyError: visibleHistoryState.error,
      isLoadingPreviousMessages: visibleHistoryState.isLoading,
      loadPreviousMessages,
      messageTotal: visibleHistoryState.total,
    }),
    [agent, loadPreviousMessages, visibleHistoryState],
  );
}
