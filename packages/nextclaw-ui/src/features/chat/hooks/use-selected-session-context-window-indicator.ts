import { useMemo } from 'react';
import type { ChatContextWindowIndicator } from '@nextclaw/agent-chat-ui';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import { buildChatContextWindowIndicator } from '@/features/chat/utils/chat-context-window-indicator.utils';

export function useSelectedSessionContextWindowIndicator(): ChatContextWindowIndicator | null {
  const selectedSessionKey = useChatSessionListStore((state) => state.snapshot.selectedSessionKey);
  const draftSessionKey = useChatSessionListStore((state) => state.snapshot.draftSessionKey);
  const liveSessionKey = useChatThreadStore((state) => state.snapshot.sessionKey);
  const liveContextWindow = useChatThreadStore((state) => state.snapshot.contextWindow);
  const currentSessionKey = selectedSessionKey ?? draftSessionKey;

  return useMemo(() => {
    if (liveSessionKey === currentSessionKey && liveContextWindow) {
      return buildChatContextWindowIndicator(liveContextWindow);
    }
    return null;
  }, [currentSessionKey, liveContextWindow, liveSessionKey]);
}
