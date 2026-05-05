import { useMemo } from 'react';
import type { ChatContextWindowIndicator } from '@nextclaw/agent-chat-ui';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { buildChatContextWindowIndicator } from '@/features/chat/utils/chat-context-window-indicator.utils';
import { adaptNcpSessionSummary } from '@/features/chat/utils/ncp-session-adapter.utils';
import { useNcpSessions } from '@/shared/hooks/use-config';

export function useSelectedSessionContextWindowIndicator(): ChatContextWindowIndicator | null {
  const selectedSessionKey = useChatSessionListStore((state) => state.snapshot.selectedSessionKey);
  const draftSessionKey = useChatSessionListStore((state) => state.snapshot.draftSessionKey);
  const sessionsQuery = useNcpSessions({ limit: 200 });
  const currentSessionKey = selectedSessionKey ?? draftSessionKey;

  return useMemo(() => {
    const summary = sessionsQuery.data?.sessions.find((session) => session.sessionId === currentSessionKey);
    if (!summary) {
      return null;
    }
    return buildChatContextWindowIndicator(adaptNcpSessionSummary(summary).contextWindow);
  }, [currentSessionKey, sessionsQuery.data?.sessions]);
}
