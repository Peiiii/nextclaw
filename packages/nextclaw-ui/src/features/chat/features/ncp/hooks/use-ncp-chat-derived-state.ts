import { useMemo } from 'react';
import type {
  NcpSessionSummaryView,
  SessionEntryView,
} from '@/shared/lib/api';
import { adaptNcpSessionSummaries } from '@/features/chat/features/session/utils/ncp-session-adapter.utils';
import { useChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';

const EMPTY_NCP_SESSION_SUMMARIES: NcpSessionSummaryView[] = [];

export function useNcpChatProviderStateResolved(): boolean {
  const isConfigResolved = useChatQueryStore(
    (state) => Boolean(state.snapshot.configQuery?.isFetched || state.snapshot.configQuery?.isSuccess),
  );
  const isProvidersResolved = useChatQueryStore(
    (state) => Boolean(state.snapshot.providersQuery?.isFetched || state.snapshot.providersQuery?.isSuccess),
  );
  const isTemplatesResolved = useChatQueryStore(
    (state) =>
      Boolean(state.snapshot.providerTemplatesQuery?.isFetched || state.snapshot.providerTemplatesQuery?.isSuccess),
  );
  return isConfigResolved && isProvidersResolved && isTemplatesResolved;
}

export function useNcpChatSelectedSession(sessionKey: string | null): SessionEntryView | null {
  const sessionSummaries = useChatQueryStore(
    (state) => state.snapshot.sessionsQuery?.data?.sessions ?? EMPTY_NCP_SESSION_SUMMARIES,
  );
  const allSessions = useMemo(
    () => adaptNcpSessionSummaries(sessionSummaries),
    [sessionSummaries],
  );
  return useMemo(
    () => allSessions.find((session) => session.key === sessionKey) ?? null,
    [allSessions, sessionKey],
  );
}
