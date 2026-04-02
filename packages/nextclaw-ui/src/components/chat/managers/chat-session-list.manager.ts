import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import type { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import type { SetStateAction } from 'react';
import type { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';

export class ChatSessionListManager {
  constructor(
    private uiManager: ChatUiManager,
    private streamActionsManager: ChatStreamActionsManager
  ) {}

  private resolveUpdateValue = <T>(prev: T, next: SetStateAction<T>): T => {
    if (typeof next === 'function') {
      return (next as (value: T) => T)(prev);
    }
    return next;
  };

  setSelectedAgentId = (next: SetStateAction<string>) => {
    const prev = useChatSessionListStore.getState().snapshot.selectedAgentId;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatSessionListStore.getState().setSnapshot({ selectedAgentId: value });
  };

  setSelectedSessionKey = (next: SetStateAction<string | null>) => {
    const prev = useChatSessionListStore.getState().snapshot.selectedSessionKey;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatSessionListStore.getState().setSnapshot({ selectedSessionKey: value });
  };

  createSession = (sessionType?: string) => {
    const { snapshot } = useChatInputStore.getState();
    const { defaultSessionType: configuredDefaultSessionType } = snapshot;
    const defaultSessionType = configuredDefaultSessionType || 'native';
    const nextSessionType =
      typeof sessionType === 'string' && sessionType.trim().length > 0
        ? sessionType.trim()
        : defaultSessionType;
    this.streamActionsManager.resetStreamState();
    useChatInputStore.getState().setSnapshot({
      pendingSessionType: nextSessionType,
      pendingProjectRoot: null,
      pendingProjectRootSessionKey: null
    });
    this.uiManager.goToChatRoot();
  };

  selectSession = (sessionKey: string) => {
    this.uiManager.goToSession(sessionKey);
  };

  setQuery = (next: SetStateAction<string>) => {
    const prev = useChatSessionListStore.getState().snapshot.query;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatSessionListStore.getState().setSnapshot({ query: value });
  };
}
