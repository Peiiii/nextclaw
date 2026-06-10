import { useEffect, useMemo } from 'react';
import type {
  NcpSessionSummaryView,
  SessionEntryView,
} from '@/shared/lib/api';
import type { UseHydratedNcpAgentResult } from '@nextclaw/ncp-react';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { readNcpContextWindowValue } from '@/features/chat/features/session/utils/ncp-session-context-metadata.utils';
import { adaptNcpSessionSummaries } from '@/features/chat/features/session/utils/ncp-session-adapter.utils';
import { useNcpChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';

const EMPTY_NCP_SESSION_SUMMARIES: NcpSessionSummaryView[] = [];

export function useNcpChatProviderStateResolved(): boolean {
  const isConfigResolved = useNcpChatQueryStore(
    (state) => Boolean(state.snapshot.configQuery?.isFetched || state.snapshot.configQuery?.isSuccess),
  );
  const isProvidersResolved = useNcpChatQueryStore(
    (state) => Boolean(state.snapshot.providersQuery?.isFetched || state.snapshot.providersQuery?.isSuccess),
  );
  const isTemplatesResolved = useNcpChatQueryStore(
    (state) =>
      Boolean(state.snapshot.providerTemplatesQuery?.isFetched || state.snapshot.providerTemplatesQuery?.isSuccess),
  );
  return isConfigResolved && isProvidersResolved && isTemplatesResolved;
}

export function useNcpChatSelectedSession(sessionKey: string | null): SessionEntryView | null {
  const sessionSummaries = useNcpChatQueryStore(
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

export function useNcpChatSnapshotSync(params: {
  canStopCurrentRun: boolean;
  lastSendError: string | null;
  isSending: boolean;
  agent: Pick<UseHydratedNcpAgentResult, 'isHydrating' | 'snapshot' | 'visibleMessages'>;
}) {
  const presenter = usePresenter();
  useEffect(() => {
    presenter.chatInputManager.syncSnapshot({
      canStopGeneration: params.canStopCurrentRun,
      stopDisabledReason: params.canStopCurrentRun ? null : '__preparing__',
      stopSupported: true,
      stopReason: undefined,
      sendError: params.lastSendError,
      isSending: params.isSending,
    });
    presenter.chatThreadManager.syncSnapshot({
      isHistoryLoading: params.agent.isHydrating,
      messages: params.agent.visibleMessages,
      isSending: params.isSending,
      isAwaitingAssistantOutput: params.canStopCurrentRun,
      contextWindow: readNcpContextWindowValue(params.agent.snapshot.contextWindow),
    });
  }, [params, presenter]);
}
