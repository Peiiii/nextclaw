import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NcpHttpAgentClientEndpoint } from "@nextclaw/ncp-http-agent-client";
import { useHydratedNcpAgent, type NcpConversationSeed } from "@nextclaw/ncp-react";
import { API_BASE, fetchNcpSessionMessages, type SessionContextWindowView } from "@/shared/lib/api";
import { createNcpAppClientFetch } from "@/features/chat/utils/ncp-app-client-fetch.utils";
import { useSystemStatus } from "@/features/system-status";

const DEFAULT_MESSAGE_LIMIT = 300;
const NCP_AGENT_UNAVAILABLE_DURING_STARTUP = "ncp agent unavailable during startup";

type UseNcpSessionConversationOptions = {
  messageLimit?: number;
};

type NcpConversationSeedWithContextWindow = NcpConversationSeed & {
  contextWindow?: SessionContextWindowView | null;
};

function isMissingNcpSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes("ncp session not found:");
}

export function isNcpAgentStartupUnavailableErrorMessage(
  message: string | null | undefined,
): boolean {
  return (
    message?.trim().toLowerCase().includes(NCP_AGENT_UNAVAILABLE_DURING_STARTUP) ??
    false
  );
}

export function createNcpSessionConversationClient(): NcpHttpAgentClientEndpoint {
  return new NcpHttpAgentClientEndpoint({
    baseUrl: API_BASE,
    basePath: "/api/ncp/agent",
    fetchImpl: createNcpAppClientFetch(),
  });
}

export async function fetchNcpSessionConversationSeed(
  sessionId: string,
  signal: AbortSignal,
  messageLimit = DEFAULT_MESSAGE_LIMIT,
): Promise<NcpConversationSeedWithContextWindow> {
  signal.throwIfAborted();

  try {
    const response = await fetchNcpSessionMessages(sessionId, messageLimit);
    signal.throwIfAborted();
    return {
      messages: response.messages,
      status: response.status ?? "idle",
      contextWindow: response.contextWindow ?? null,
    };
  } catch (error) {
    signal.throwIfAborted();
    if (!isMissingNcpSessionError(error)) {
      throw error;
    }
    return {
      messages: [],
      status: "idle",
    };
  }
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
  sessionId: string,
  options: UseNcpSessionConversationOptions = {},
) {
  const [client] = useState(() => createNcpSessionConversationClient());
  const systemStatus = useSystemStatus();
  const [hydrationRetryVersion, setHydrationRetryVersion] = useState(0);
  const [seedContextWindow, setSeedContextWindow] = useState<SessionContextWindowView | null>(null);
  const messageLimit = options.messageLimit ?? DEFAULT_MESSAGE_LIMIT;
  useEffect(() => {
    setSeedContextWindow(null);
  }, [sessionId]);
  const loadSeed = useCallback(
    async (targetSessionId: string, signal: AbortSignal) => {
      void hydrationRetryVersion;
      const seed = await fetchNcpSessionConversationSeed(targetSessionId, signal, messageLimit);
      if (!signal.aborted) {
        setSeedContextWindow(seed.contextWindow ?? null);
      }
      return {
        messages: seed.messages,
        status: seed.status,
      };
    },
    [hydrationRetryVersion, messageLimit],
  );
  const agent = useHydratedNcpAgent({
    sessionId,
    client,
    loadSeed,
  });
  const currentAgentError =
    agent.hydrateError?.message ?? agent.snapshot.error?.message ?? null;
  const readyRetrySignature =
    systemStatus.phase === "ready" &&
    isNcpAgentStartupUnavailableErrorMessage(currentAgentError)
      ? `${sessionId}:${systemStatus.lastReadyAt ?? 0}`
      : null;
  useSyncReadyRetryVersion(readyRetrySignature, () => {
    setHydrationRetryVersion((current) => current + 1);
  });
  return useMemo(() => ({
    ...agent,
    snapshot: {
      ...agent.snapshot,
      contextWindow: agent.snapshot.contextWindow ?? seedContextWindow,
    },
  }), [agent, seedContextWindow]);
}
