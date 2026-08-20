import { useCallback, useEffect, useRef, useState } from "react";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  fetchNcpSessionMessageDetail,
  fetchNcpSessionMessages,
  type SessionContextWindowView,
} from "@/shared/lib/api";
import {
  useNcpSessionSeedLoader,
  type NcpConversationSeedWithContextWindow,
} from "@/features/chat/features/ncp/hooks/use-ncp-session-seed-loader";

export type SessionMessageToolPayloadState = "summary" | "loading" | "ready" | "error";

type SessionHistoryState = {
  sessionId: string | null;
  contextWindow: SessionContextWindowView | null;
  total: number;
  cursor: string | null;
  hasPreviousPage: boolean;
  isLoading: boolean;
  error: Error | null;
  deferredToolPayloads: Record<string, { cursor: string }>;
  messageDetails: Record<string, NcpMessage>;
  messageDetailStates: Record<string, SessionMessageToolPayloadState>;
};

const EMPTY_SESSION_HISTORY_STATE: SessionHistoryState = {
  sessionId: null,
  contextWindow: null,
  total: 0,
  cursor: null,
  hasPreviousPage: false,
  isLoading: false,
  error: null,
  deferredToolPayloads: {},
  messageDetails: {},
  messageDetailStates: {},
};

type UpdateSessionHistoryState = (
  sessionId: string,
  update: (current: SessionHistoryState) => SessionHistoryState,
) => void;

function useSessionMessageDetailLoader(params: {
  sessionId: string | undefined;
  historyStateRef: { current: SessionHistoryState };
  updateHistoryState: UpdateSessionHistoryState;
}) {
  const { historyStateRef, sessionId, updateHistoryState } = params;
  const requestsRef = useRef(new Map<string, {
    controller: AbortController;
    promise: Promise<void>;
  }>());
  useEffect(() => {
    const requests = requestsRef.current;
    for (const request of requests.values()) request.controller.abort();
    requests.clear();
    return () => {
      for (const request of requests.values()) request.controller.abort();
      requests.clear();
    };
  }, [sessionId]);
  return useCallback(async (messageId: string): Promise<void> => {
    if (!sessionId) return;
    const history = historyStateRef.current;
    if (history.sessionId !== sessionId || history.messageDetails[messageId]) return;
    const cursor = history.deferredToolPayloads[messageId]?.cursor;
    if (!cursor) return;
    const existing = requestsRef.current.get(messageId);
    if (existing) return await existing.promise;
    const controller = new AbortController();
    updateHistoryState(sessionId, (current) => ({
      ...current,
      messageDetailStates: { ...current.messageDetailStates, [messageId]: "loading" },
    }));
    const promise = (async () => {
      try {
        const message = await fetchNcpSessionMessageDetail(
          sessionId,
          messageId,
          cursor,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        updateHistoryState(sessionId, (current) => ({
          ...current,
          messageDetails: { ...current.messageDetails, [messageId]: message },
          messageDetailStates: { ...current.messageDetailStates, [messageId]: "ready" },
        }));
      } catch {
        if (controller.signal.aborted) return;
        updateHistoryState(sessionId, (current) => ({
          ...current,
          messageDetailStates: { ...current.messageDetailStates, [messageId]: "error" },
        }));
      } finally {
        if (requestsRef.current.get(messageId)?.controller === controller) {
          requestsRef.current.delete(messageId);
        }
      }
    })();
    requestsRef.current.set(messageId, { controller, promise });
    await promise;
  }, [historyStateRef, sessionId, updateHistoryState]);
}

export function useNcpSessionMessageHistory(params: {
  sessionId: string | undefined;
  messageLimit: number;
  hydrationRetryVersion: number;
}) {
  const { hydrationRetryVersion, messageLimit, sessionId } = params;
  const [historyState, setHistoryState] = useState<SessionHistoryState>(
    EMPTY_SESSION_HISTORY_STATE,
  );
  const historyStateRef = useRef<SessionHistoryState>(
    EMPTY_SESSION_HISTORY_STATE,
  );
  const historyRequestRef = useRef<AbortController | null>(null);
  const updateHistoryState = useCallback(
    (
      targetSessionId: string,
      update: (current: SessionHistoryState) => SessionHistoryState,
    ) => {
      const current =
        historyStateRef.current.sessionId === targetSessionId
          ? historyStateRef.current
          : { ...EMPTY_SESSION_HISTORY_STATE, sessionId: targetSessionId };
      const next = update(current);
      historyStateRef.current = next;
      setHistoryState(next);
    },
    [],
  );
  useEffect(() => {
    historyRequestRef.current?.abort();
    historyRequestRef.current = null;
    return () => {
      historyRequestRef.current?.abort();
    };
  }, [sessionId]);
  const loadMessageDetails = useSessionMessageDetailLoader({
    historyStateRef,
    sessionId,
    updateHistoryState,
  });
  const onSeedLoaded = useCallback((
    targetSessionId: string,
    seed: NcpConversationSeedWithContextWindow,
  ) => {
    updateHistoryState(targetSessionId, (current) => ({
      ...current,
      contextWindow: seed.contextWindow ?? null,
      deferredToolPayloads: seed.deferredToolPayloads,
      messageDetails: {},
      messageDetailStates: Object.fromEntries(
        Object.keys(seed.deferredToolPayloads).map((messageId) => [messageId, "summary"]),
      ),
      total: seed.total,
      cursor: seed.pageInfo.startCursor,
      hasPreviousPage: seed.pageInfo.hasPreviousPage,
      error: null,
    }));
  }, [updateHistoryState]);
  const loadSeed = useNcpSessionSeedLoader({
    hydrationRetryVersion,
    messageLimit,
    onSeedLoaded,
  });
  const loadPreviousMessages = useCallback(
    async (
      prependHistory: (messages: ReadonlyArray<NcpMessage>) => void,
    ) => {
      const history = historyStateRef.current;
      if (
        !sessionId ||
        history.sessionId !== sessionId ||
        !history.hasPreviousPage ||
        !history.cursor ||
        historyRequestRef.current
      ) {
        return;
      }
      const controller = new AbortController();
      historyRequestRef.current = controller;
      updateHistoryState(sessionId, (current) => ({
        ...current,
        isLoading: true,
        error: null,
      }));
      try {
        const response = await fetchNcpSessionMessages(sessionId, {
          limit: messageLimit,
          cursor: history.cursor,
          toolPayload: "summary",
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          historyRequestRef.current !== controller
        ) {
          return;
        }
        prependHistory(response.messages);
        updateHistoryState(sessionId, (current) => ({
          ...current,
          contextWindow: response.contextWindow ?? current.contextWindow,
          deferredToolPayloads: {
            ...current.deferredToolPayloads,
            ...(response.deferredToolPayloads ?? {}),
          },
          messageDetailStates: {
            ...Object.fromEntries(
              Object.keys(response.deferredToolPayloads ?? {}).map((messageId) => [messageId, "summary"]),
            ),
            ...current.messageDetailStates,
          },
          total: response.total,
          cursor: response.pageInfo.startCursor,
          hasPreviousPage: response.pageInfo.hasPreviousPage,
        }));
      } catch (error) {
        if (!controller.signal.aborted) {
          updateHistoryState(sessionId, (current) => ({
            ...current,
            error: error instanceof Error ? error : new Error(String(error)),
          }));
        }
      } finally {
        if (historyRequestRef.current === controller) {
          historyRequestRef.current = null;
          updateHistoryState(sessionId, (current) => ({
            ...current,
            isLoading: false,
          }));
        }
      }
    },
    [messageLimit, sessionId, updateHistoryState],
  );
  return {
    loadSeed,
    loadPreviousMessages,
    loadMessageDetails,
    state:
      historyState.sessionId === sessionId
        ? historyState
        : EMPTY_SESSION_HISTORY_STATE,
  };
}
