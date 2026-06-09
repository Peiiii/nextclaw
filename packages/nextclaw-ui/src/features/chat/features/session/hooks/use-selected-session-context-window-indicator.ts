import { useMemo } from 'react';
import type { ChatContextWindowIndicator } from '@nextclaw/agent-chat-ui';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import { buildChatContextWindowIndicator } from '@/features/chat/features/session/utils/chat-context-window-indicator.utils';

export function useSelectedSessionContextWindowIndicator(): ChatContextWindowIndicator | null {
  const selectedSessionKey = useChatSessionListStore((state) => state.snapshot.selectedSessionKey);
  const liveSessionKey = useChatThreadStore((state) => state.snapshot.sessionKey);
  const liveContextWindow = useChatThreadStore((state) => state.snapshot.contextWindow);

  return useMemo(() => {
    if (selectedSessionKey && liveSessionKey === selectedSessionKey && liveContextWindow) {
      return buildChatContextWindowIndicator(liveContextWindow);
    }
    return null;
  }, [liveContextWindow, liveSessionKey, selectedSessionKey]);
}
