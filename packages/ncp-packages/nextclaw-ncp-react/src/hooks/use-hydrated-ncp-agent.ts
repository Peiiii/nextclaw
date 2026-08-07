import { useCallback, useEffect, useState } from "react";
import type { NcpAgentClientEndpoint, NcpMessage } from "@nextclaw/ncp";
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
  replaceHistory: (seed: NcpConversationSeed) => void;
};

type HydrationState = {
  sessionId: string | null;
  error: Error | null;
};

const STREAM_RECONNECT_DELAY_MS = 500;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function managerAlreadyHasSessionState(manager: DefaultNcpAgentConversationStateManager, sessionId: string): boolean {
  const snapshot = manager.getSnapshot();
  return (
    snapshot.activeRun?.sessionId === sessionId ||
    snapshot.streamingMessage?.sessionId === sessionId ||
    snapshot.messages.some((message) => message.sessionId === sessionId)
  );
}

function waitForStreamReconnect(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, STREAM_RECONNECT_DELAY_MS));
}

export function useHydratedNcpAgent({
  sessionId,
  client,
  loadSeed
}: UseHydratedNcpAgentOptions): UseHydratedNcpAgentResult {
  const manager = useScopedAgentManager(sessionId);
  const runtime = useNcpAgentRuntime({ sessionId, client, manager });
  const [hydration, setHydration] = useState<HydrationState>({
    sessionId: null,
    error: null
  });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const settle = (error: Error | null) => {
      setHydration({ sessionId: sessionId ?? null, error });
    };

    const connect = async () => {
      if (!sessionId) {
        manager.reset();
        settle(null);
        await client.stop();
        return;
      }

      let needsSeed = !managerAlreadyHasSessionState(manager, sessionId);
      if (needsSeed) {
        manager.reset();
        setHydration({ sessionId: null, error: null });
      } else {
        settle(null);
      }

      await client.stop();
      while (!signal.aborted) {
        try {
          if (needsSeed) {
            const seed = await loadSeed(sessionId, signal);
            if (signal.aborted) return;
            manager.hydrate({
              sessionId,
              messages: seed.messages,
              activeRun: seed.status === "running"
                ? { runId: null, sessionId, abortDisabledReason: null }
                : null
            });
            settle(null);
            needsSeed = false;
          }
          await client.stream({ sessionId });
          if (signal.aborted) return;
          throw new Error("Live conversation stream disconnected.");
        } catch (error) {
          if (signal.aborted) return;
          settle(toError(error));
        }
        needsSeed = true;
        await waitForStreamReconnect();
      }
    };

    void connect().catch((error) => {
      if (signal.aborted) return;
      settle(toError(error));
    });

    return () => {
      controller.abort();
    };
  }, [client, loadSeed, manager, sessionId]);

  const prependHistory = useCallback(
    (messages: ReadonlyArray<NcpMessage>) => manager.prependHistory(messages),
    [manager]
  );
  const replaceHistory = useCallback((seed: NcpConversationSeed) => {
    if (!sessionId) {
      return;
    }
    manager.hydrate({
      sessionId,
      messages: seed.messages,
      activeRun: seed.status === "running"
        ? { runId: null, sessionId, abortDisabledReason: null }
        : null,
    });
  }, [manager, sessionId]);

  return {
    ...runtime,
    isHydrating: Boolean(sessionId && hydration.sessionId !== sessionId),
    hydrateError: hydration.error,
    prependHistory,
    replaceHistory,
  };
}
