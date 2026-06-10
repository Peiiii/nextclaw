import { createContext, useContext, type ReactNode } from 'react';
import type {
  ChatSessionListManager,
} from '@/features/chat/managers/chat-session-list.manager';
import type { ChatRunManager } from '@/features/chat/managers/chat-run.manager';
import type { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import type { ChatInputManager } from '@/features/chat/managers/chat-input.manager';
import type { ChatQueryManager } from '@/features/chat/managers/chat-query.manager';
import type { ChatThreadManager } from '@/features/chat/managers/chat-thread.manager';

type PublicManager<T extends object> = Pick<T, keyof T>;

export type ChatInputManagerLike = PublicManager<ChatInputManager>;
export type ChatThreadManagerLike = PublicManager<ChatThreadManager>;

export type ChatPresenterLike = {
  chatUiManager: ChatUiManager;
  chatRunManager: ChatRunManager;
  chatInputManager: ChatInputManagerLike;
  chatQueryManager: ChatQueryManager;
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
