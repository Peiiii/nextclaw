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

type StreamRecoveryState = {
  consecutiveFailures: number;
  hasHydrated: boolean;
};

const STREAM_RECONNECT_DELAY_MS = 500;
const STREAM_STABLE_DURATION_MS = 10_000;
const STREAM_FAILURES_BEFORE_ERROR = 3;

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

function reportStreamRecoveryFailure(
  state: StreamRecoveryState,
  error: unknown,
  settle: (error: Error | null) => void,
): StreamRecoveryState {
  const consecutiveFailures = state.consecutiveFailures + 1;
  settle(
    !state.hasHydrated || consecutiveFailures >= STREAM_FAILURES_BEFORE_ERROR
      ? toError(error)
      : null,
  );
  return { ...state, consecutiveFailures };
}

async function hydrateConversationSeed(params: {
  loadSeed: NcpConversationSeedLoader;
  manager: DefaultNcpAgentConversationStateManager;
  sessionId: string;
  signal: AbortSignal;
}): Promise<void> {
  const { loadSeed, manager, sessionId, signal } = params;
  const seed = await loadSeed(sessionId, signal);
  if (signal.aborted) return;
  manager.hydrate({
    sessionId,
    messages: seed.messages,
    activeRun: seed.status === "running"
      ? { runId: null, sessionId, abortDisabledReason: null }
      : null,
  });
}

async function waitForStreamDisconnect(params: {
  client: NcpAgentClientEndpoint;
  sessionId: string;
  signal: AbortSignal;
}): Promise<{ error: unknown; stable: boolean } | null> {
  const { client, sessionId, signal } = params;
  const startedAt = Date.now();
  let error: unknown;
  try {
    await client.stream({ sessionId });
    error = new Error("Live conversation stream disconnected.");
  } catch (caught) {
    error = caught;
  }
  return signal.aborted
    ? null
    : { error, stable: Date.now() - startedAt >= STREAM_STABLE_DURATION_MS };
}

async function stopInactiveSession(
  client: NcpAgentClientEndpoint,
  manager: DefaultNcpAgentConversationStateManager,
  settle: (error: Error | null) => void,
): Promise<void> {
  manager.reset();
  settle(null);
  await client.stop();
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
        await stopInactiveSession(client, manager, settle);
        return;
      }

      let needsSeed = !managerAlreadyHasSessionState(manager, sessionId);
      let recoveryState: StreamRecoveryState = {
        consecutiveFailures: 0,
        hasHydrated: !needsSeed,
      };
      if (needsSeed) {
        manager.reset();
        setHydration({ sessionId: null, error: null });
      } else {
        settle(null);
      }

      await client.stop();
      while (!signal.aborted) {
        if (needsSeed) {
          try {
            await hydrateConversationSeed({ loadSeed, manager, sessionId, signal });
            if (signal.aborted) return;
            settle(null);
            recoveryState = { ...recoveryState, hasHydrated: true };
            needsSeed = false;
          } catch (error) {
            if (signal.aborted) return;
            recoveryState = reportStreamRecoveryFailure(recoveryState, error, settle);
            await waitForStreamReconnect();
            continue;
          }
        }

        const disconnect = await waitForStreamDisconnect({ client, sessionId, signal });
        if (!disconnect) return;
        if (disconnect.stable) {
          recoveryState = { ...recoveryState, consecutiveFailures: 0 };
          settle(null);
        } else {
          recoveryState = reportStreamRecoveryFailure(recoveryState, disconnect.error, settle);
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
