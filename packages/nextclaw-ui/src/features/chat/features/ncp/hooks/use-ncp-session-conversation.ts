import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NcpHttpAgentClientEndpoint } from "@nextclaw/ncp-http-agent-client";
import { useHydratedNcpAgent } from "@nextclaw/ncp-react";
import type {
  NcpRunHandle,
} from "@nextclaw/ncp";
import type {
  AgentRunContinueIngressPayload,
  AgentRunEditMessageIngressPayload,
} from "@nextclaw/shared";
import { API_BASE } from "@/shared/lib/api";
import { createNcpAppClientFetch } from "@/features/chat/features/runtime/utils/ncp-app-client-fetch.utils";
import {
  DEFAULT_NCP_SESSION_MESSAGE_LIMIT,
  useNcpSessionMessageHistory,
} from "@/features/chat/features/ncp/hooks/use-ncp-session-message-history";
import { useSystemStatus } from "@/features/system-status";
import { nextclawClient } from "@/shared/lib/api";

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
  const [pendingCommandSessionId, setPendingCommandSessionId] = useState<string | null>(null);
  const pendingCommandSessionIdRef = useRef<string | null>(null);
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
  const { acceptRun } = agent;
  const executeAcceptedRunCommand = useCallback(async (
    commandSessionId: string,
    command: () => Promise<NcpRunHandle>,
  ): Promise<NcpRunHandle> => {
    if (pendingCommandSessionIdRef.current) {
      throw new Error("A session command is already in progress.");
    }
    pendingCommandSessionIdRef.current = commandSessionId;
    setPendingCommandSessionId(commandSessionId);
    try {
      const handle = await command();
      await acceptRun(handle);
      return handle;
    } finally {
      if (pendingCommandSessionIdRef.current === commandSessionId) {
        pendingCommandSessionIdRef.current = null;
      }
      setPendingCommandSessionId((current) =>
        current === commandSessionId ? null : current,
      );
    }
  }, [acceptRun]);
  const editMessage = useCallback(
    async (payload: AgentRunEditMessageIngressPayload) =>
      await executeAcceptedRunCommand(payload.sessionId, async () => {
        const previousSeed = {
          messages: agent.visibleMessages,
          status: agent.isRunning ? "running" as const : "idle" as const,
        };
        const anchorIndex = agent.visibleMessages.findIndex(
          (message) => message.id === payload.messageId,
        );
        if (anchorIndex < 0) {
          throw new Error("The message being edited is no longer in the current session history.");
        }
        agent.replaceHistory({
          messages: [
            ...agent.visibleMessages.slice(0, anchorIndex),
            { ...payload.message, sessionId: payload.sessionId },
          ],
          status: "idle",
        });
        try {
          return await nextclawClient.agentRuns.editMessage(payload);
        } catch (error) {
          agent.replaceHistory(previousSeed);
          try {
            const controller = new AbortController();
            agent.replaceHistory(
              await loadSeed(payload.sessionId, controller.signal),
            );
          } catch {
            // The previous in-memory snapshot remains available when recovery hydration fails.
          }
          throw error;
        }
      }),
    [agent, executeAcceptedRunCommand, loadSeed],
  );
  const continueRun = useCallback(
    async (payload: AgentRunContinueIngressPayload) =>
      await executeAcceptedRunCommand(payload.sessionId, () =>
        nextclawClient.agentRuns.continue(payload),
      ),
    [executeAcceptedRunCommand],
  );
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
      isSending:
        agent.isSending || pendingCommandSessionId === sessionId,
      editMessage,
      continueRun,
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
    [
      agent,
      continueRun,
      editMessage,
      loadPreviousMessages,
      pendingCommandSessionId,
      sessionId,
      visibleHistoryState,
    ],
  );
}
