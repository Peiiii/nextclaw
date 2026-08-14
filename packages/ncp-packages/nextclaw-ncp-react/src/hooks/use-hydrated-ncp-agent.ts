import { useCallback, useEffect, useState } from "react";
import type {
  NcpAgentClientEndpoint,
  NcpAgentConversationSnapshot,
  NcpMessage,
} from "@nextclaw/ncp";
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

function settleStreamDisconnect(
  state: StreamRecoveryState,
  disconnect: { error: unknown; stable: boolean },
  settle: (error: Error | null) => void,
): StreamRecoveryState {
  if (!disconnect.stable) {
    return reportStreamRecoveryFailure(state, disconnect.error, settle);
  }
  settle(null);
  return { ...state, consecutiveFailures: 0 };
}

async function hydrateConversationSeed(params: {
  loadSeed: NcpConversationSeedLoader;
  manager: DefaultNcpAgentConversationStateManager;
  sessionId: string;
  signal: AbortSignal;
  reconcileFrom?: NcpAgentConversationSnapshot;
}): Promise<void> {
  const { loadSeed, manager, reconcileFrom, sessionId, signal } = params;
  const seed = await loadSeed(sessionId, signal);
  if (signal.aborted) return;
  const current = manager.getSnapshot();
  const hasLiveUpdates = Boolean(reconcileFrom && current !== reconcileFrom);
  const messages = hasLiveUpdates
    ? reconcileConversationMessages(seed, current)
    : seed.messages;
  manager.hydrate({
    sessionId,
    messages,
    activeRun: hasLiveUpdates
      ? current.activeRun
      : seed.status === "running"
        ? { runId: null, sessionId, abortDisabledReason: null }
        : null,
  });
}

function reconcileConversationMessages(
  seed: NcpConversationSeed,
  current: NcpAgentConversationSnapshot,
): readonly NcpMessage[] {
  const currentMessages = [
    ...current.messages,
    ...(current.streamingMessage ? [current.streamingMessage] : []),
  ];
  const currentById = new Map(currentMessages.map((message) => [message.id, message]));
  const merged = seed.messages.map((message) => {
    const liveMessage = currentById.get(message.id);
    if (!liveMessage) {
      return message;
    }
    currentById.delete(message.id);
    const seedSettled = message.status === "final" || message.status === "error";
    const liveSettled = liveMessage.status === "final" || liveMessage.status === "error";
    return seedSettled && !liveSettled ? message : liveMessage;
  });
  for (const message of currentById.values()) {
    const settled = message.status === "final" || message.status === "error";
    if (settled || message.role === "user" || seed.status === "running" || current.activeRun) {
      merged.push(message);
    }
  }
  return merged;
}

async function waitForStreamDisconnect(params: {
  client: NcpAgentClientEndpoint;
  onOpen?: () => void;
  sessionId: string;
  signal: AbortSignal;
}): Promise<{ error: unknown; stable: boolean } | null> {
  const { client, onOpen, sessionId, signal } = params;
  const startedAt = Date.now();
  let error: unknown;
  try {
    await client.stream({ sessionId }, { onOpen });
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

        let reconcilePromise = Promise.resolve();
        const disconnect = await waitForStreamDisconnect({
          client,
          sessionId,
          signal,
          onOpen: () => {
            const reconcileFrom = manager.getSnapshot();
            reconcilePromise = hydrateConversationSeed({
              loadSeed,
              manager,
              reconcileFrom,
              sessionId,
              signal,
            }).then(() => {
              if (signal.aborted) return;
              settle(null);
              recoveryState = { ...recoveryState, hasHydrated: true };
            }).catch((error) => {
              if (signal.aborted) return;
              recoveryState = reportStreamRecoveryFailure(recoveryState, error, settle);
            });
          },
        });
        await reconcilePromise;
        if (!disconnect) return;
        recoveryState = settleStreamDisconnect(recoveryState, disconnect, settle);
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
