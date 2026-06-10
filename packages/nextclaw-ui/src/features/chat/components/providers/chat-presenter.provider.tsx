import { createContext, useContext, type ReactNode } from 'react';
import type {
  ChatSessionListManager,
} from '@/features/chat/managers/chat-session-list.manager';
import type { ChatStreamActionsManager } from '@/features/chat/managers/chat-stream-actions.manager';
import type { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import type { NcpChatInputManager } from '@/features/chat/managers/ncp-chat-input.manager';
import type { NcpChatQueryManager } from '@/features/chat/managers/ncp-chat-query.manager';
import type { NcpChatThreadManager } from '@/features/chat/managers/ncp-chat-thread.manager';

type PublicManager<T extends object> = Pick<T, keyof T>;

export type ChatInputManagerLike = PublicManager<NcpChatInputManager>;
export type ChatThreadManagerLike = PublicManager<NcpChatThreadManager>;

export type ChatPresenterLike = {
  chatUiManager: ChatUiManager;
  chatStreamActionsManager: ChatStreamActionsManager;
  chatInputManager: ChatInputManagerLike;
  chatQueryManager: NcpChatQueryManager;
  chatSessionListManager: ChatSessionListManager;
  chatThreadManager: ChatThreadManagerLike;
  startAgentCreationDraft: (prompt: string) => void;
};

const ChatPresenterContext = createContext<ChatPresenterLike | null>(null);
export function ChatPresenterProvider({ presenter, children }: { presenter: ChatPresenterLike; children: ReactNode }) {
  return <ChatPresenterContext.Provider value={presenter}>{children}</ChatPresenterContext.Provider>;
}

export function usePresenter(): ChatPresenterLike {
  const presenter = useContext(ChatPresenterContext);
  if (!presenter) {
    throw new Error('usePresenter must be used inside ChatPresenterProvider');
  }
  return presenter;
}
