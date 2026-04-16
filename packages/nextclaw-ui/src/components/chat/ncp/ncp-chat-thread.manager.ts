import { appQueryClient } from '@/app-query-client';
import { deleteNcpSessionSummaryInQueryClient } from '@/api/ncp-session-query-cache';
import { deleteNcpSession as deleteNcpSessionApi } from '@/api/ncp-session';
import type {
  ChatFileOpenActionViewModel,
  ChatToolActionViewModel,
} from '@nextclaw/agent-chat-ui';
import type { ChatSessionListManager } from '@/components/chat/managers/chat-session-list.manager';
import type { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';
import type { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import type {
  ChatThreadSnapshot,
  ChatWorkspaceFileTab,
} from '@/components/chat/stores/chat-thread.store';
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

  private clearDeletedSessionState = (sessionKey: string) => {
    if (useChatSessionListStore.getState().snapshot.selectedSessionKey === sessionKey) {
      this.sessionListManager.setSelectedSessionKey(null);
    }
    useChatThreadStore.getState().setSnapshot({
      sessionKey: null,
      sessionTypeLabel: null,
      agentId: null,
      agentDisplayName: null,
      agentAvatarUrl: null,
      sessionDisplayName: undefined,
      sessionProjectRoot: null,
      sessionProjectName: null,
      canDeleteSession: false,
      isHistoryLoading: false,
      messages: [],
      isSending: false,
      isAwaitingAssistantOutput: false,
      parentSessionKey: null,
      parentSessionLabel: null,
      workspacePanelParentKey: null,
      childSessionTabs: [],
      activeChildSessionKey: null,
      workspaceFileTabs: [],
      activeWorkspaceFileKey: null,
    });
  };

  private resolveWorkspaceParentSessionKey = (): string | null => {
    const threadSessionKey = useChatThreadStore.getState().snapshot.sessionKey?.trim();
    if (threadSessionKey) {
      return threadSessionKey;
    }
    return useChatSessionListStore.getState().snapshot.selectedSessionKey ?? null;
  };

  private buildWorkspaceFileTab = (
    action: ChatFileOpenActionViewModel,
    parentSessionKey: string | null,
  ): ChatWorkspaceFileTab | null => {
    const normalizedPath = action.path.trim();
    if (!normalizedPath) {
      return null;
    }
    const normalizedParentSessionKey = parentSessionKey?.trim() || null;
    const key =
      `${normalizedParentSessionKey ?? 'draft'}::${action.viewMode}::${normalizedPath}`;
    return {
      key,
      parentSessionKey: normalizedParentSessionKey,
      path: normalizedPath,
      label: action.label?.trim() || null,
      viewMode: action.viewMode,
      line: action.line ?? null,
      column: action.column ?? null,
      rawText: action.rawText ?? null,
      beforeText: action.beforeText ?? null,
      afterText: action.afterText ?? null,
      patchText: action.patchText ?? null,
      oldStartLine: action.oldStartLine ?? null,
      newStartLine: action.newStartLine ?? null,
      fullLines: action.fullLines,
    };
  };

  private upsertWorkspaceFileTab = (nextTab: ChatWorkspaceFileTab): ChatWorkspaceFileTab[] => {
    const { workspaceFileTabs } = useChatThreadStore.getState().snapshot;
    const existingIndex = workspaceFileTabs.findIndex((tab) => tab.key === nextTab.key);
    if (existingIndex === -1) {
      return [nextTab, ...workspaceFileTabs];
    }
    const nextTabs = [...workspaceFileTabs];
    nextTabs.splice(existingIndex, 1);
    nextTabs.unshift({
      ...workspaceFileTabs[existingIndex],
      ...nextTab,
    });
    return nextTabs;
  };

  private ensureWorkspaceParentRoute = (parentSessionKey: string | null) => {
    if (!parentSessionKey) {
      return;
    }
    const {
      snapshot: { selectedSessionKey },
    } = useChatSessionListStore.getState();
    if (selectedSessionKey !== parentSessionKey) {
      this.uiManager.goToSession(parentSessionKey);
    }
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
      workspacePanelParentKey: parentSessionKey,
      activeChildSessionKey,
      activeWorkspaceFileKey: null,
    });
    this.ensureWorkspaceParentRoute(parentSessionKey);
  };

  openFilePreview = (action: ChatFileOpenActionViewModel) => {
    const parentSessionKey = this.resolveWorkspaceParentSessionKey();
    const nextTab = this.buildWorkspaceFileTab(action, parentSessionKey);
    if (!nextTab) {
      return;
    }
    useChatThreadStore.getState().setSnapshot({
      workspacePanelParentKey: parentSessionKey,
      workspaceFileTabs: this.upsertWorkspaceFileTab(nextTab),
      activeWorkspaceFileKey: nextTab.key,
      activeChildSessionKey: null,
    });
    this.ensureWorkspaceParentRoute(parentSessionKey);
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
      workspacePanelParentKey: null,
      activeChildSessionKey: null,
      activeWorkspaceFileKey: null,
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
      activeWorkspaceFileKey: null,
    });
  };

  selectWorkspaceFile = (fileKey: string) => {
    const normalizedFileKey = fileKey.trim();
    if (!normalizedFileKey) {
      return;
    }
    const { workspaceFileTabs } = useChatThreadStore.getState().snapshot;
    if (!workspaceFileTabs.some((tab) => tab.key === normalizedFileKey)) {
      return;
    }
    useChatThreadStore.getState().setSnapshot({
      activeWorkspaceFileKey: normalizedFileKey,
      activeChildSessionKey: null,
    });
  };

  closeWorkspaceFile = (fileKey: string) => {
    const normalizedFileKey = fileKey.trim();
    if (!normalizedFileKey) {
      return;
    }
    const { snapshot } = useChatThreadStore.getState();
    const { activeWorkspaceFileKey, workspaceFileTabs } = snapshot;
    const nextTabs = workspaceFileTabs.filter(
      (tab) => tab.key !== normalizedFileKey,
    );
    const nextPatch: Partial<ChatThreadSnapshot> = {
      workspaceFileTabs: nextTabs,
    };
    if (activeWorkspaceFileKey === normalizedFileKey) {
      nextPatch.activeWorkspaceFileKey = null;
    }
    useChatThreadStore.getState().setSnapshot(nextPatch);
  };

  closeWorkspacePanel = () => {
    useChatThreadStore.getState().setSnapshot({
      workspacePanelParentKey: null,
      activeChildSessionKey: null,
      activeWorkspaceFileKey: null,
    });
  };

  closeChildSessionDetail = () => {
    this.closeWorkspacePanel();
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
    this.closeWorkspacePanel();
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
      this.clearDeletedSessionState(selectedSessionKey);
      this.uiManager.goToChatRoot({ replace: true });
    } finally {
      useChatThreadStore.getState().setSnapshot({ isDeletePending: false });
    }
  };
}
