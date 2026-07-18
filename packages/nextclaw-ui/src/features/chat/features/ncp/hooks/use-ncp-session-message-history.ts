import { useCallback, useEffect, useRef, useState } from "react";
import type { NcpMessage, NcpSessionMessagePageInfo } from "@nextclaw/ncp";
import type { NcpConversationSeed } from "@nextclaw/ncp-react";
import {
  fetchNcpSessionMessages,
  type SessionContextWindowView,
} from "@/shared/lib/api";

export const DEFAULT_NCP_SESSION_MESSAGE_LIMIT = 80;

type NcpConversationSeedWithContextWindow = NcpConversationSeed & {
  contextWindow?: SessionContextWindowView | null;
  total: number;
  pageInfo: NcpSessionMessagePageInfo;
};

type SessionHistoryState = {
  sessionId: string | null;
  contextWindow: SessionContextWindowView | null;
  total: number;
  cursor: string | null;
  hasPreviousPage: boolean;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY_SESSION_HISTORY_STATE: SessionHistoryState = {
  sessionId: null,
  contextWindow: null,
  total: 0,
  cursor: null,
  hasPreviousPage: false,
  isLoading: false,
  error: null,
};

function isMissingNcpSessionError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("ncp session not found:")
  );
}

export async function fetchNcpSessionConversationSeed(
  sessionId: string,
  signal: AbortSignal,
  messageLimit = DEFAULT_NCP_SESSION_MESSAGE_LIMIT,
): Promise<NcpConversationSeedWithContextWindow> {
  signal.throwIfAborted();
  try {
    const response = await fetchNcpSessionMessages(sessionId, {
      limit: messageLimit,
      signal,
    });
    signal.throwIfAborted();
    return {
      messages: response.messages,
      status: response.status ?? "idle",
      contextWindow: response.contextWindow ?? null,
      total: response.total,
      pageInfo: response.pageInfo,
    };
  } catch (error) {
    signal.throwIfAborted();
    if (!isMissingNcpSessionError(error)) {
      throw error;
    }
    return {
      messages: [],
      status: "idle",
      total: 0,
      pageInfo: { startCursor: null, hasPreviousPage: false },
    };
  }
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
    return () => historyRequestRef.current?.abort();
  }, [sessionId]);
  const loadSeed = useCallback(
    async (targetSessionId: string, signal: AbortSignal) => {
      void hydrationRetryVersion;
      const seed = await fetchNcpSessionConversationSeed(
        targetSessionId,
        signal,
        messageLimit,
      );
      if (!signal.aborted) {
        updateHistoryState(targetSessionId, (current) => ({
          ...current,
          contextWindow: seed.contextWindow ?? null,
          total: seed.total,
          cursor: seed.pageInfo.startCursor,
          hasPreviousPage: seed.pageInfo.hasPreviousPage,
          error: null,
        }));
      }
      return { messages: seed.messages, status: seed.status };
    },
    [hydrationRetryVersion, messageLimit, updateHistoryState],
  );
  const loadPreviousMessages = useCallback(
    async (prependHistory: (messages: ReadonlyArray<NcpMessage>) => void) => {
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
    state:
      historyState.sessionId === sessionId
        ? historyState
        : EMPTY_SESSION_HISTORY_STATE,
  };
}
