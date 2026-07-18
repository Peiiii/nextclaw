import { useCallback, useEffect, useRef, useState } from "react";
import type { NcpAgentClientEndpoint, NcpMessage, NcpRunContext } from "@nextclaw/ncp";
import type { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import { useNcpAgentRuntime, useScopedAgentManager, type UseNcpAgentResult } from "./use-ncp-agent-runtime.js";

export type NcpConversationSeed = {
  messages: readonly NcpMessage[];
  status: "idle" | "running";
};

export type NcpConversationSeedLoader = (sessionId: string, signal: AbortSignal) => Promise<NcpConversationSeed>;

export type UseHydratedNcpAgentOptions = {
  sessionId?: string;
  client: NcpAgentClientEndpoint;
  loadSeed: NcpConversationSeedLoader;
};

export type UseHydratedNcpAgentResult = UseNcpAgentResult & {
  isHydrating: boolean;
  hydrateError: Error | null;
  prependHistory: (messages: ReadonlyArray<NcpMessage>) => void;
};

type LoadState = {
  requestId: number;
  controller: AbortController | null;
};

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function resolveSessionHydratingState(params: {
  sessionId?: string;
  hydratedSessionId: string | null;
  isHydrating: boolean;
}): boolean {
  const { hydratedSessionId, isHydrating, sessionId } = params;
  if (!sessionId) {
    return false;
  }
  return isHydrating || hydratedSessionId !== sessionId;
}

function managerAlreadyHasSessionState(manager: DefaultNcpAgentConversationStateManager, sessionId: string): boolean {
  const snapshot = manager.getSnapshot();
  return (
    snapshot.activeRun?.sessionId === sessionId ||
    snapshot.streamingMessage?.sessionId === sessionId ||
    snapshot.messages.some((message) => message.sessionId === sessionId)
  );
}

function createHydratedActiveRun(seed: NcpConversationSeed, sessionId: string): NcpRunContext | null {
  return seed.status === "running"
    ? {
        runId: null,
        sessionId,
        abortDisabledReason: null
      }
    : null;
}

function isStaleHydrationRequest(loadState: LoadState, requestId: number, controller: AbortController): boolean {
  return controller.signal.aborted || loadState.requestId !== requestId;
}

export function useHydratedNcpAgent({
  sessionId,
  client,
  loadSeed
}: UseHydratedNcpAgentOptions): UseHydratedNcpAgentResult {
  const manager = useScopedAgentManager(sessionId);
  const runtime = useNcpAgentRuntime({ sessionId, client, manager });
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrateError, setHydrateError] = useState<Error | null>(null);
  const [hydratedSessionId, setHydratedSessionId] = useState<string | null>(null);
  const loadStateRef = useRef<LoadState>({ requestId: 0, controller: null });

  const resetEmptySession = useCallback(async () => {
    loadStateRef.current = {
      requestId: loadStateRef.current.requestId + 1,
      controller: null
    };
    manager.reset();
    setHydrateError(null);
    setHydratedSessionId(null);
    setIsHydrating(false);
    await client.stop();
  }, [client, manager]);

  const markHydratedFromLiveState = useCallback((targetSessionId: string) => {
    setHydrateError(null);
    setHydratedSessionId(targetSessionId);
    setIsHydrating(false);
  }, []);

  const hydrateSeed = useCallback(async () => {
    loadStateRef.current.controller?.abort();

    if (!sessionId) {
      await resetEmptySession();
      return;
    }

    const controller = new AbortController();
    const requestId = loadStateRef.current.requestId + 1;
    loadStateRef.current = {
      requestId,
      controller
    };

    if (managerAlreadyHasSessionState(manager, sessionId)) {
      markHydratedFromLiveState(sessionId);
      if (loadStateRef.current.controller === controller) {
        loadStateRef.current.controller = null;
      }
      return;
    }

    await client.stop();
    manager.reset();
    setHydrateError(null);
    setIsHydrating(true);

    try {
      const seed = await loadSeed(sessionId, controller.signal);
      if (isStaleHydrationRequest(loadStateRef.current, requestId, controller)) {
        return;
      }

      manager.hydrate({
        sessionId,
        messages: seed.messages,
        activeRun: createHydratedActiveRun(seed, sessionId)
      });
      markHydratedFromLiveState(sessionId);
      void client.stream({ sessionId }).catch((error) => {
        if (loadStateRef.current.requestId !== requestId) {
          return;
        }
        setHydrateError(toError(error));
      });
    } catch (error) {
      if (isStaleHydrationRequest(loadStateRef.current, requestId, controller)) {
        return;
      }
      setHydrateError(toError(error));
      setHydratedSessionId(sessionId);
      setIsHydrating(false);
    } finally {
      if (loadStateRef.current.controller === controller) {
        loadStateRef.current.controller = null;
      }
    }
  }, [client, loadSeed, manager, markHydratedFromLiveState, resetEmptySession, sessionId]);

  useEffect(() => {
    void hydrateSeed();

    return () => {
      loadStateRef.current.controller?.abort();
      loadStateRef.current.controller = null;
    };
  }, [hydrateSeed]);

  const prependHistory = useCallback(
    (messages: ReadonlyArray<NcpMessage>) => manager.prependHistory(messages),
    [manager]
  );

  return {
    ...runtime,
    isHydrating: resolveSessionHydratingState({
      sessionId,
      hydratedSessionId,
      isHydrating
    }),
    hydrateError,
    prependHistory
  };
}
