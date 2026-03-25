import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { SetStateAction } from 'react';
import type { ChatRunStatusManager } from '@/components/chat/managers/chat-run-status.manager';
import type { ChatSessionListManager } from '@/components/chat/managers/chat-session-list.manager';
import type { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';
import type { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import type { ChatThreadSnapshot } from '@/components/chat/stores/chat-thread.store';
import type { ThinkingLevel } from '@/api/types';

export type ChatInputManagerLike = {
  syncSnapshot: (patch: Record<string, unknown>) => void;
  setDraft: (next: SetStateAction<string>) => void;
  setComposerNodes: (next: SetStateAction<ChatComposerNode[]>) => void;
  addAttachments?: (attachments: NcpDraftAttachment[]) => NcpDraftAttachment[];
  restoreComposerState?: (
    nodes: ChatComposerNode[],
    attachments: NcpDraftAttachment[]
  ) => void;
  setPendingSessionType: (next: SetStateAction<string>) => void;
  send: () => Promise<void>;
  stop: () => Promise<void>;
  goToProviders: () => void;
  setSelectedModel: (next: SetStateAction<string>) => void;
  setSelectedThinkingLevel: (next: SetStateAction<ThinkingLevel | null>) => void;
  setSelectedSkills: (next: SetStateAction<string[]>) => void;
  selectSessionType: (value: string) => void;
  selectModel: (value: string) => void;
  selectThinkingLevel: (value: ThinkingLevel) => void;
  selectSkills: (next: string[]) => void;
};

export type ChatThreadManagerLike = {
  bindActions: (patch: { refetchSessions?: () => Promise<unknown> }) => void;
  syncSnapshot: (patch: Partial<ChatThreadSnapshot>) => void;
  deleteSession: () => void;
  createSession: () => void;
  goToProviders: () => void;
};

export type ChatPresenterLike = {
  chatUiManager: ChatUiManager;
  chatStreamActionsManager: ChatStreamActionsManager;
  chatInputManager: ChatInputManagerLike;
  chatSessionListManager: ChatSessionListManager;
  chatRunStatusManager: ChatRunStatusManager;
  chatThreadManager: ChatThreadManagerLike;
};

const ChatPresenterContext = createContext<ChatPresenterLike | null>(null);

type ChatPresenterProviderProps = {
  presenter: ChatPresenterLike;
  children: ReactNode;
};

export function ChatPresenterProvider({ presenter, children }: ChatPresenterProviderProps) {
  return <ChatPresenterContext.Provider value={presenter}>{children}</ChatPresenterContext.Provider>;
}

export function usePresenter(): ChatPresenterLike {
  const presenter = useContext(ChatPresenterContext);
  if (!presenter) {
    throw new Error('usePresenter must be used inside ChatPresenterProvider');
  }
  return presenter;
}

// Backward-compatible alias with the name from project notes.
export const usePresneter = usePresenter;
