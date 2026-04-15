import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';
import type { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import type { SetStateAction } from 'react';
import type { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';
import { normalizeSessionProjectRootValue } from '@/lib/session-project/session-project.utils';
import { createNcpSessionId } from '@/components/chat/ncp/ncp-session-adapter';
import { updateNcpSession } from '@/api/ncp-session';

export class ChatSessionListManager {
  constructor(
    private uiManager: ChatUiManager,
    private streamActionsManager: ChatStreamActionsManager
  ) {}

  private syncDraftThreadState = (sessionKey: string) => {
    useChatThreadStore.getState().setSnapshot({
      sessionKey,
      sessionDisplayName: undefined,
      canDeleteSession: false,
      isHistoryLoading: false,
      messages: [],
      isSending: false,
      isAwaitingAssistantOutput: false,
      parentSessionKey: null,
      parentSessionLabel: null,
      childSessionPanelParentKey: null,
      childSessionTabs: [],
      activeChildSessionKey: null,
    });
  };

  private resolveUpdateValue = <T>(prev: T, next: SetStateAction<T>): T => {
    if (typeof next === 'function') {
      return (next as (value: T) => T)(prev);
    }
    return next;
  };

  private shouldPersistReadAt = (
    sessionKey: string,
    readAt: string,
    currentReadAt?: string | null,
  ): boolean => {
    const optimisticReadAt = useChatSessionListStore.getState().optimisticReadAtBySessionKey[sessionKey];
    const effectiveCurrentReadAt =
      optimisticReadAt && currentReadAt
        ? (optimisticReadAt.localeCompare(currentReadAt) > 0 ? optimisticReadAt : currentReadAt)
        : optimisticReadAt ?? currentReadAt ?? undefined;
    if (!effectiveCurrentReadAt) {
      return true;
    }
    return readAt.localeCompare(effectiveCurrentReadAt) > 0;
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

  markSessionRead = (
    sessionKey: string | null | undefined,
    readAt: string | null | undefined,
    currentReadAt?: string | null,
  ) => {
    const normalizedSessionKey = sessionKey?.trim();
    const normalizedReadAt = readAt?.trim();
    if (!normalizedSessionKey || !normalizedReadAt) {
      return;
    }
    if (!this.shouldPersistReadAt(normalizedSessionKey, normalizedReadAt, currentReadAt)) {
      return;
    }
    useChatSessionListStore.getState().markSessionRead(normalizedSessionKey, normalizedReadAt);
    void updateNcpSession(normalizedSessionKey, { uiReadAt: normalizedReadAt }).catch(() => undefined);
  };

  createSession = (sessionType?: string, projectRoot?: string | null): string => {
    const { snapshot } = useChatInputStore.getState();
    const { defaultSessionType: configuredDefaultSessionType } = snapshot;
    const defaultSessionType = configuredDefaultSessionType || 'native';
    const nextSessionType =
      typeof sessionType === 'string' && sessionType.trim().length > 0
        ? sessionType.trim()
        : defaultSessionType;
    const normalizedProjectRoot = normalizeSessionProjectRootValue(projectRoot);
    const nextSessionKey = createNcpSessionId();
    this.streamActionsManager.resetStreamState();
    useChatSessionListStore.getState().setSnapshot({
      selectedSessionKey: null,
      draftSessionKey: nextSessionKey
    });
    this.syncDraftThreadState(nextSessionKey);
    useChatInputStore.getState().setSnapshot({
      pendingSessionType: nextSessionType,
      pendingProjectRoot: normalizedProjectRoot,
      pendingProjectRootSessionKey: normalizedProjectRoot ? nextSessionKey : null
    });
    this.uiManager.goToChatRoot();
    return nextSessionKey;
  };

  ensureDraftSession = (sessionType?: string): string => {
    const { snapshot } = useChatSessionListStore.getState();
    if (snapshot.selectedSessionKey) {
      return snapshot.selectedSessionKey;
    }
    const normalizedSessionType =
      typeof sessionType === 'string' && sessionType.trim().length > 0
        ? sessionType.trim()
        : null;
    this.syncDraftThreadState(snapshot.draftSessionKey);
    if (normalizedSessionType) {
      useChatInputStore.getState().setSnapshot({ pendingSessionType: normalizedSessionType });
    }
    return snapshot.draftSessionKey;
  };

  promoteRootDraftSessionRoute = (sessionKey: string) => {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey) {
      return;
    }
    const { snapshot } = useChatSessionListStore.getState();
    const { sessionKey: currentThreadSessionKey } = useChatThreadStore.getState().snapshot;
    if (
      snapshot.selectedSessionKey !== null ||
      snapshot.draftSessionKey !== normalizedSessionKey ||
      currentThreadSessionKey !== normalizedSessionKey ||
      !this.uiManager.isAtChatRoot()
    ) {
      return;
    }
    this.uiManager.goToSession(normalizedSessionKey, { replace: true });
  };

  selectSession = (sessionKey: string) => {
    useChatThreadStore.getState().setSnapshot({
      childSessionPanelParentKey: null,
      activeChildSessionKey: null,
    });
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
