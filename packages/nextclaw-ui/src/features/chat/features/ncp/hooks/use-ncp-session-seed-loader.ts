import { useCallback, useRef } from "react";
import type { NcpSessionMessagePageInfo } from "@nextclaw/ncp";
import type { NcpConversationSeed } from "@nextclaw/ncp-react";
import {
  fetchNcpSessionMessages,
  type NcpSessionMessagesView,
  type SessionContextWindowView,
} from "@/shared/lib/api";

export const DEFAULT_NCP_SESSION_MESSAGE_LIMIT = 20;

export type NcpConversationSeedWithContextWindow = NcpConversationSeed & {
  contextWindow?: SessionContextWindowView | null;
  deferredToolPayloads: Record<string, { cursor: string }>;
  total: number;
  pageInfo: NcpSessionMessagePageInfo;
};

function isMissingNcpSessionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("ncp session not found:");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function waitForPrefetch<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return await new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    void promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

async function takeInitialSessionMessagesPrefetch(params: {
  sessionId: string;
  messageLimit: number;
  signal: AbortSignal;
}): Promise<NcpSessionMessagesView | null> {
  const { messageLimit, sessionId, signal } = params;
  const prefetch = window.__NEXTCLAW_INITIAL_SESSION_MESSAGES_PREFETCH__;
  if (
    !prefetch ||
    prefetch.consumed ||
    prefetch.sessionId !== sessionId ||
    prefetch.limit !== messageLimit
  ) {
    return null;
  }
  prefetch.consumed = true;
  const result = await waitForPrefetch(prefetch.promise, signal);
  signal.throwIfAborted();
  if (!result?.responseOk || !isRecord(result.payload)) return null;
  const { payload } = result;
  if (payload.ok !== true || !isRecord(payload.data)) return null;
  const { data } = payload;
  if (
    data.sessionId !== sessionId ||
    !Array.isArray(data.messages) ||
    !isRecord(data.pageInfo)
  ) {
    return null;
  }
  return data as NcpSessionMessagesView;
}

export async function fetchNcpSessionConversationSeed(
  sessionId: string,
  signal: AbortSignal,
  messageLimit = DEFAULT_NCP_SESSION_MESSAGE_LIMIT,
  payloadMode: "compact" | "standard" = "compact",
): Promise<NcpConversationSeedWithContextWindow> {
  signal.throwIfAborted();
  try {
    const prefetchedResponse = payloadMode === "compact"
      ? await takeInitialSessionMessagesPrefetch({ sessionId, messageLimit, signal })
      : null;
    const response = prefetchedResponse ?? await fetchNcpSessionMessages(sessionId, {
      limit: messageLimit,
      toolPayload: "summary",
      initialPayload: payloadMode === "compact" ? "compact" : undefined,
      signal,
    });
    signal.throwIfAborted();
    return {
      messages: response.messages,
      status: response.status ?? "idle",
      contextWindow: response.contextWindow ?? null,
      deferredToolPayloads: response.deferredToolPayloads ?? {},
      total: response.total,
      pageInfo: response.pageInfo,
    };
  } catch (error) {
    signal.throwIfAborted();
    if (!isMissingNcpSessionError(error)) throw error;
    return {
      messages: [],
      status: "idle",
      total: 0,
      deferredToolPayloads: {},
      pageInfo: { startCursor: null, hasPreviousPage: false },
    };
  }
}

export function useNcpSessionSeedLoader(params: {
  hydrationRetryVersion: number;
  messageLimit: number;
  onSeedLoaded: (
    sessionId: string,
    seed: NcpConversationSeedWithContextWindow,
  ) => void;
}) {
  const { hydrationRetryVersion, messageLimit, onSeedLoaded } = params;
  const hydratedSessionsRef = useRef(new Set<string>());
  return useCallback(async (sessionId: string, signal: AbortSignal) => {
    void hydrationRetryVersion;
    const payloadMode = hydratedSessionsRef.current.has(sessionId) ? "standard" : "compact";
    const seed = await fetchNcpSessionConversationSeed(
      sessionId,
      signal,
      messageLimit,
      payloadMode,
    );
    if (!signal.aborted) {
      hydratedSessionsRef.current.add(sessionId);
      onSeedLoaded(sessionId, seed);
    }
    return { messages: seed.messages, status: seed.status };
  }, [hydrationRetryVersion, messageLimit, onSeedLoaded]);
}
