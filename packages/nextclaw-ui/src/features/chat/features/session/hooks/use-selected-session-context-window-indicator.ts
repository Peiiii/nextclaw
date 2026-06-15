import { useMemo } from 'react';
import type { ChatContextWindowIndicator } from '@nextclaw/agent-chat-ui';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import { buildChatContextWindowIndicator } from '@/features/chat/features/session/utils/chat-context-window-indicator.utils';

export function useSelectedSessionContextWindowIndicator(): ChatContextWindowIndicator | null {
  const liveContextWindow = useChatThreadStore(
    (state) => state.snapshot.contextWindow,
  );

  return useMemo(
    () => buildChatContextWindowIndicator(liveContextWindow),
    [liveContextWindow],
  );
}
