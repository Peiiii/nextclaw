import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import type { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import type { SetStateAction } from 'react';
import type { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';
import { normalizeSessionProjectRootValue } from '@/lib/session-project/session-project.utils';
import { createNcpSessionId } from '@/components/chat/ncp/ncp-session-adapter';

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

  setListMode = (next: SetStateAction<'time-first' | 'project-first'>) => {
    const prev = useChatSessionListStore.getState().snapshot.listMode;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatSessionListStore.getState().setSnapshot({ listMode: value });
  };

  createSession = (sessionType?: string, projectRoot?: string | null): string => {
    const { snapshot } = useChatInputStore.getState();
    const { snapshot: sessionListSnapshot } = useChatSessionListStore.getState();
    const { defaultSessionType: configuredDefaultSessionType } = snapshot;
    const defaultSessionType = configuredDefaultSessionType || 'native';
    const nextSessionType =
      typeof sessionType === 'string' && sessionType.trim().length > 0
        ? sessionType.trim()
        : defaultSessionType;
    const normalizedProjectRoot = normalizeSessionProjectRootValue(projectRoot);
    const nextSessionKey = sessionListSnapshot.draftSessionKey;
    this.streamActionsManager.resetStreamState();
    useChatSessionListStore.getState().setSnapshot({
      draftSessionKey: createNcpSessionId()
    });
    useChatInputStore.getState().setSnapshot({
      pendingSessionType: nextSessionType,
      pendingProjectRoot: normalizedProjectRoot,
      pendingProjectRootSessionKey: normalizedProjectRoot ? nextSessionKey : null
    });
    this.uiManager.goToSession(nextSessionKey);
    return nextSessionKey;
  };

  ensureDraftSession = (sessionType?: string): string => {
    const { snapshot } = useChatSessionListStore.getState();
    if (snapshot.selectedSessionKey) {
      return snapshot.selectedSessionKey;
    }
    return this.createSession(sessionType);
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
