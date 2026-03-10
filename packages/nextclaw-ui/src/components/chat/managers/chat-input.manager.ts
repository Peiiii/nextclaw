import { updateSession } from '@/api/config';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { buildNewSessionKey } from '@/components/chat/chat-session-route';
import type { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { normalizeSessionType } from '@/components/chat/useChatSessionTypeState';
import type { ChatInputSnapshot } from '@/components/chat/stores/chat-input.store';
import type { SetStateAction } from 'react';
import type { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';

export class ChatInputManager {
  constructor(
    private uiManager: ChatUiManager,
    private streamActionsManager: ChatStreamActionsManager
  ) {}

  private hasSnapshotChanges = (patch: Partial<ChatInputSnapshot>): boolean => {
    const current = useChatInputStore.getState().snapshot;
    for (const [key, value] of Object.entries(patch) as Array<[keyof ChatInputSnapshot, ChatInputSnapshot[keyof ChatInputSnapshot]]>) {
      if (!Object.is(current[key], value)) {
        return true;
      }
    }
    return false;
  };

  private resolveUpdateValue = <T>(prev: T, next: SetStateAction<T>): T => {
    if (typeof next === 'function') {
      return (next as (value: T) => T)(prev);
    }
    return next;
  };

  syncSnapshot = (patch: Partial<ChatInputSnapshot>) => {
    if (!this.hasSnapshotChanges(patch)) {
      return;
    }
    useChatInputStore.getState().setSnapshot(patch);
  };

  setDraft = (next: SetStateAction<string>) => {
    const prev = useChatInputStore.getState().snapshot.draft;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatInputStore.getState().setSnapshot({ draft: value });
  };

  setPendingSessionType = (next: SetStateAction<string>) => {
    const prev = useChatInputStore.getState().snapshot.pendingSessionType;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatInputStore.getState().setSnapshot({ pendingSessionType: value });
  };

  send = async () => {
    const inputSnapshot = useChatInputStore.getState().snapshot;
    const sessionSnapshot = useChatSessionListStore.getState().snapshot;
    const message = inputSnapshot.draft.trim();
    if (!message) {
      return;
    }
    const requestedSkills = inputSnapshot.selectedSkills;
    const hasSelectedSession = Boolean(sessionSnapshot.selectedSessionKey);
    const sessionKey = sessionSnapshot.selectedSessionKey ?? buildNewSessionKey(sessionSnapshot.selectedAgentId);
    if (!hasSelectedSession) {
      this.uiManager.goToSession(sessionKey, { replace: true });
    }
    this.setDraft('');
    this.setSelectedSkills([]);
    await this.streamActionsManager.sendMessage({
      message,
      sessionKey,
      agentId: sessionSnapshot.selectedAgentId,
      sessionType: inputSnapshot.selectedSessionType,
      model: inputSnapshot.selectedModel || undefined,
      stopSupported: inputSnapshot.stopSupported,
      stopReason: inputSnapshot.stopReason,
      requestedSkills,
      restoreDraftOnError: true
    });
  };

  stop = async () => {
    await this.streamActionsManager.stopCurrentRun();
  };

  goToProviders = () => {
    this.uiManager.goToProviders();
  };

  setSelectedModel = (next: SetStateAction<string>) => {
    const prev = useChatInputStore.getState().snapshot.selectedModel;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatInputStore.getState().setSnapshot({ selectedModel: value });
  };

  selectSessionType = (value: string) => {
    const normalized = normalizeSessionType(value);
    useChatInputStore.getState().setSnapshot({ selectedSessionType: normalized, pendingSessionType: normalized });
    void this.syncRemoteSessionType(normalized);
  };

  setSelectedSkills = (next: SetStateAction<string[]>) => {
    const prev = useChatInputStore.getState().snapshot.selectedSkills;
    const value = this.resolveUpdateValue(prev, next);
    if (Object.is(value, prev)) {
      return;
    }
    useChatInputStore.getState().setSnapshot({ selectedSkills: value });
  };

  selectModel = (value: string) => {
    this.setSelectedModel(value);
  };

  selectSkills = (next: string[]) => {
    this.setSelectedSkills(next);
  };

  private syncRemoteSessionType = async (normalizedType: string) => {
    const sessionSnapshot = useChatSessionListStore.getState().snapshot;
    const selectedSessionKey = sessionSnapshot.selectedSessionKey;
    if (!selectedSessionKey) {
      return;
    }
    const selectedSession = sessionSnapshot.sessions.find((session) => session.key === selectedSessionKey);
    if (!selectedSession?.sessionTypeMutable) {
      return;
    }
    if (normalizeSessionType(selectedSession.sessionType) === normalizedType) {
      return;
    }
    await updateSession(selectedSessionKey, { sessionType: normalizedType });
  };
}
