import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import type { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import type { SetStateAction } from 'react';
import type { ChatStreamActionsManager } from '@/features/chat/managers/chat-stream-actions.manager';
import { normalizeSessionProjectRootValue } from '@/shared/lib/session-project';
import { updateNcpSession } from '@/shared/lib/api';
import { CHAT_DRAFT_SESSION_PATH } from '@/features/chat/utils/chat-session-route.utils';
export class ChatSessionListManager {
  constructor(
    private uiManager: ChatUiManager,
    private streamActionsManager: ChatStreamActionsManager
  ) {}

  private syncDraftThreadState = (hasSubmittedDraftMessage = false) => {
    useChatThreadStore.getState().setSnapshot({
      sessionKey: null,
      sessionDisplayName: undefined,
      canDeleteSession: false,
      isHistoryLoading: false,
      messages: [],
      isSending: false,
      isAwaitingAssistantOutput: false,
      hasSubmittedDraftMessage,
      parentSessionKey: null,
      parentSessionLabel: null,
      workspacePanelParentKey: null,
      activeWorkspacePanelKind: null,
      childSessionTabs: [],
      activeChildSessionKey: null,
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
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

  createSession = (sessionType?: string, projectRoot?: string | null): void => {
    const { snapshot } = useChatInputStore.getState();
    const { defaultSessionType: configuredDefaultSessionType } = snapshot;
    const defaultSessionType = configuredDefaultSessionType || 'native';
    const nextSessionType =
      typeof sessionType === 'string' && sessionType.trim().length > 0
        ? sessionType.trim()
        : defaultSessionType;
    const normalizedProjectRoot = normalizeSessionProjectRootValue(projectRoot);
    this.streamActionsManager.resetStreamState();
    useChatSessionListStore.getState().setSnapshot({
      selectedSessionKey: null,
    });
    this.syncDraftThreadState();
    useChatInputStore.getState().setSnapshot({
      pendingSessionType: nextSessionType,
      pendingProjectRoot: normalizedProjectRoot,
      pendingProjectRootSessionKey: null
    });
    this.uiManager.navigateTo(CHAT_DRAFT_SESSION_PATH);
  };

  startAgentDraftChat = (agentId: string, sessionType: string): void => {
    const normalizedAgentId = agentId.trim() || 'main';
    this.createSession(sessionType);
    this.setSelectedAgentId(normalizedAgentId);
  };

  ensureDraftSession = (sessionType?: string): string | null => {
    const { snapshot } = useChatSessionListStore.getState();
    if (snapshot.selectedSessionKey) {
      return snapshot.selectedSessionKey;
    }
    const normalizedSessionType =
      typeof sessionType === 'string' && sessionType.trim().length > 0
        ? sessionType.trim()
        : null;
    this.syncDraftThreadState(true);
    if (normalizedSessionType) {
      useChatInputStore.getState().setSnapshot({ pendingSessionType: normalizedSessionType });
    }
    return null;
  };

  materializeRootSessionRoute = (sessionKey: string) => {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey) {
      return;
    }
    if (!this.uiManager.isAtChatRoot()) {
      return;
    }
    this.uiManager.goToSession(normalizedSessionKey, { replace: true });
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
