import { appQueryClient } from '@/app-query-client';
import { deleteNcpSessionSummaryInQueryClient } from '@/api/ncp-session-query-cache';
import { deleteNcpSession as deleteNcpSessionApi } from '@/api/ncp-session';
import type { ChatToolActionViewModel } from '@nextclaw/agent-chat-ui';
import type { ChatSessionListManager } from '@/components/chat/managers/chat-session-list.manager';
import type { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';
import type { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import type { ChatThreadSnapshot } from '@/components/chat/stores/chat-thread.store';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';
import { t } from '@/lib/i18n';

export class NcpChatThreadManager {
  constructor(
    private uiManager: ChatUiManager,
    private sessionListManager: ChatSessionListManager,
    private streamActionsManager: ChatStreamActionsManager
  ) {}

  private hasSnapshotChanges = (patch: Partial<ChatThreadSnapshot>): boolean => {
    const current = useChatThreadStore.getState().snapshot;
    for (const [key, value] of Object.entries(patch) as Array<[keyof ChatThreadSnapshot, ChatThreadSnapshot[keyof ChatThreadSnapshot]]>) {
      if (!Object.is(current[key], value)) {
        return true;
      }
    }
    return false;
  };

  syncSnapshot = (patch: Partial<ChatThreadSnapshot>) => {
    if (!this.hasSnapshotChanges(patch)) {
      return;
    }
    useChatThreadStore.getState().setSnapshot(patch);
  };

  deleteSession = () => {
    void this.deleteCurrentSession();
  };

  createSession = () => {
    this.sessionListManager.createSession();
  };

  goToProviders = () => {
    this.uiManager.goToProviders();
  };

  openChildSessionPanel = (params: {
    parentSessionKey: string;
    activeChildSessionKey?: string | null;
  }) => {
    const parentSessionKey = params.parentSessionKey.trim();
    if (!parentSessionKey) {
      return;
    }
    const activeChildSessionKey = params.activeChildSessionKey?.trim() || null;
    useChatThreadStore.getState().setSnapshot({
      childSessionPanelParentKey: parentSessionKey,
      activeChildSessionKey,
    });
    const {
      snapshot: { selectedSessionKey },
    } = useChatSessionListStore.getState();
    if (selectedSessionKey !== parentSessionKey) {
      this.uiManager.goToSession(parentSessionKey);
    }
  };

  openSessionFromToolAction = (action: ChatToolActionViewModel) => {
    if (action.kind !== 'open-session') {
      return;
    }
    if (action.sessionKind === 'child' && !this.isCompactViewport()) {
      const parentSessionKey =
        action.parentSessionId?.trim() ||
        useChatSessionListStore.getState().snapshot.selectedSessionKey ||
        null;
      if (parentSessionKey) {
        this.openChildSessionPanel({
          parentSessionKey,
          activeChildSessionKey: action.sessionId,
        });
        return;
      }
    }
    useChatThreadStore.getState().setSnapshot({
      childSessionPanelParentKey: null,
      activeChildSessionKey: null,
    });
    this.uiManager.goToSession(action.sessionId);
  };

  selectChildSessionDetail = (sessionKey: string) => {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey) {
      return;
    }
    const { childSessionTabs } = useChatThreadStore.getState().snapshot;
    if (!childSessionTabs.some((tab) => tab.sessionKey === normalizedSessionKey)) {
      return;
    }
    useChatThreadStore.getState().setSnapshot({
      activeChildSessionKey: normalizedSessionKey,
    });
  };

  closeChildSessionDetail = () => {
    useChatThreadStore.getState().setSnapshot({
      childSessionPanelParentKey: null,
      activeChildSessionKey: null,
    });
  };

  goToParentSession = () => {
    const {
      parentSessionKey,
      childSessionTabs,
      activeChildSessionKey,
    } = useChatThreadStore.getState().snapshot;
    const activeChildParentSessionKey =
      childSessionTabs.find((tab) => tab.sessionKey === activeChildSessionKey)
        ?.parentSessionKey ?? null;
    const resolvedParentSessionKey =
      parentSessionKey ?? activeChildParentSessionKey;
    if (!resolvedParentSessionKey) {
      return;
    }
    this.closeChildSessionDetail();
    this.uiManager.goToSession(resolvedParentSessionKey);
  };

  private isCompactViewport = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(max-width: 767px)').matches;
  };

  private deleteCurrentSession = async () => {
    const {
      snapshot: { selectedSessionKey }
    } = useChatSessionListStore.getState();
    if (!selectedSessionKey) {
      return;
    }
    const confirmed = await this.uiManager.confirm({
      title: t('chatDeleteSessionConfirm'),
      variant: 'destructive',
      confirmLabel: t('delete')
    });
    if (!confirmed) {
      return;
    }
    useChatThreadStore.getState().setSnapshot({ isDeletePending: true });
    try {
      await deleteNcpSessionApi(selectedSessionKey);
      deleteNcpSessionSummaryInQueryClient(appQueryClient, selectedSessionKey);
      appQueryClient.removeQueries({ queryKey: ['ncp-session-messages', selectedSessionKey] });
      this.streamActionsManager.resetStreamState();
      this.uiManager.goToChatRoot({ replace: true });
    } finally {
      useChatThreadStore.getState().setSnapshot({ isDeletePending: false });
    }
  };
}
