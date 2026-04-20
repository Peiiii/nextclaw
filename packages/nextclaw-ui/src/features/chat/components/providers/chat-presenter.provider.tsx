import { createContext, useContext, type ReactNode, type SetStateAction } from 'react';
import type { ChatComposerNode, ChatFileOpenActionViewModel, ChatToolActionViewModel } from '@nextclaw/agent-chat-ui';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';
import type { ThinkingLevel } from '@/api/types';
import type { ChatSessionListManager } from '@/features/chat/managers/chat-session-list.manager';
import type { ChatStreamActionsManager } from '@/features/chat/managers/chat-stream-actions.manager';
import type { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import type { ChatThreadSnapshot } from '@/features/chat/stores/chat-thread.store';

export type ChatInputManagerLike = {
  syncSnapshot: (patch: Record<string, unknown>) => void;
  setDraft: (next: SetStateAction<string>) => void;
  setComposerNodes: (next: SetStateAction<ChatComposerNode[]>) => void;
  addAttachments?: (attachments: NcpDraftAttachment[]) => NcpDraftAttachment[];
  restoreComposerState?: (nodes: ChatComposerNode[], attachments: NcpDraftAttachment[]) => void;
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
  rememberSkillSelection: (value: string) => void;
};

export type ChatThreadManagerLike = {
  syncSnapshot: (patch: Partial<ChatThreadSnapshot>) => void;
  deleteSession: () => void;
  createSession: () => void;
  goToProviders: () => void;
  openChildSessionPanel: (params: { parentSessionKey: string; activeChildSessionKey?: string | null }) => void;
  openFilePreview: (action: ChatFileOpenActionViewModel) => void;
  openSessionFromToolAction: (action: ChatToolActionViewModel) => void;
  selectChildSessionDetail: (sessionKey: string) => void;
  selectWorkspaceFile: (fileKey: string) => void;
  closeWorkspaceFile: (fileKey: string) => void;
  closeWorkspacePanel: () => void;
  goToParentSession: () => void;
};

export type ChatPresenterLike = {
  chatUiManager: ChatUiManager;
  chatStreamActionsManager: ChatStreamActionsManager;
  chatInputManager: ChatInputManagerLike;
  chatSessionListManager: ChatSessionListManager;
  chatThreadManager: ChatThreadManagerLike;
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
