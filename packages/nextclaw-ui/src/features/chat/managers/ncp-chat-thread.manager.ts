import { appQueryClient } from '@/app-query-client';
import {
  deleteNcpSession as deleteNcpSessionApi,
  deleteNcpSessionSummaryInQueryClient,
  nextclawClient,
  type PanelAppEntryView,
} from '@/shared/lib/api';
import type {
  ChatFileOpenActionViewModel,
  ChatUiShowContentRequest,
  ChatToolActionViewModel,
} from '@nextclaw/agent-chat-ui';
import type { ChatSessionListManager } from '@/features/chat/managers/chat-session-list.manager';
import type { ChatStreamActionsManager } from '@/features/chat/managers/chat-stream-actions.manager';
import type { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import type {
  ChatThreadSnapshot,
  ChatWorkspaceNavigationEntry,
  ChatWorkspaceFileTab,
} from '@/features/chat/stores/chat-thread.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import { viewportLayoutManager } from '@/app/managers/viewport-layout.manager';
import {
  createPanelAppResourceUri,
  createPanelAppRightPanelResourceTarget,
} from '@/features/right-panel-resources';
import { t } from '@/shared/lib/i18n';
import {
  filterNavigationHistoryEntries,
  pushNavigationHistoryEntry,
  stepNavigationHistory,
} from '@/shared/lib/navigation-history';
import type { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';

function areWorkspaceNavigationEntriesEqual(
  current: ChatWorkspaceNavigationEntry,
  next: ChatWorkspaceNavigationEntry,
): boolean {
  if (current.kind !== next.kind) {
    return false;
  }
  if (current.kind === 'cron') {
    return true;
  }
  return next.kind !== 'cron' && current.key === next.key;
}

type WorkspaceChildReadState = Parameters<ChatSessionListManager['markVisibleWorkspaceChildRead']>[0];
export type ChatVisibleWorkspaceSelection = { kind: 'child-session'; tab: WorkspaceChildReadState } | { kind: 'file' | 'cron' } | null;

function isPanelAppEntryMatch(entry: PanelAppEntryView, value: string): boolean {
  const normalizedValue = value.trim();
  return [entry.id, entry.appId, entry.fileName, entry.title].some((candidate) => candidate.trim() === normalizedValue);
}

export class NcpChatThreadManager {
  constructor(
    private uiManager: ChatUiManager,
    private sessionListManager: ChatSessionListManager,
    private streamActionsManager: ChatStreamActionsManager,
    private docBrowserManager: DocBrowserManager,
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
      activeWorkspacePanelKind: null,
      childSessionTabs: [],
      activeChildSessionKey: null,
      workspaceFileTabs: [],
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
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

  private createWorkspaceSelectionPatch = (
    entry: ChatWorkspaceNavigationEntry,
    snapshot: ChatThreadSnapshot,
  ): Partial<ChatThreadSnapshot> | null => {
    if (entry.kind === 'cron') {
      return {
        activeWorkspacePanelKind: 'cron',
        activeChildSessionKey: null,
        activeWorkspaceFileKey: null,
      };
    }
    if (entry.kind === 'file') {
      if (!snapshot.workspaceFileTabs.some((tab) => tab.key === entry.key)) {
        return null;
      }
      return {
        activeWorkspacePanelKind: 'file',
        activeChildSessionKey: null,
        activeWorkspaceFileKey: entry.key,
      };
    }
    if (!entry.key) {
      return null;
    }
    return {
      activeWorkspacePanelKind: 'child-session',
      activeChildSessionKey: entry.key,
      activeWorkspaceFileKey: null,
    };
  };

  private setWorkspaceSelection = (
    patch: Partial<ChatThreadSnapshot>,
    entry: ChatWorkspaceNavigationEntry,
  ) => {
    const { snapshot } = useChatThreadStore.getState();
    const history = pushNavigationHistoryEntry(
      {
        entries: snapshot.workspaceNavigationHistory,
        index: snapshot.workspaceNavigationHistoryIndex,
      },
      entry,
      areWorkspaceNavigationEntriesEqual,
    );
    useChatThreadStore.getState().setSnapshot({
      ...patch,
      workspaceNavigationHistory: [...history.entries],
      workspaceNavigationHistoryIndex: history.index,
    });
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
    const patch: Partial<ChatThreadSnapshot> = {
      workspacePanelParentKey: parentSessionKey,
      activeWorkspacePanelKind: 'child-session',
      activeChildSessionKey,
      activeWorkspaceFileKey: null,
    };
    if (activeChildSessionKey) {
      this.setWorkspaceSelection(patch, {
        kind: 'child-session',
        key: activeChildSessionKey,
      });
    } else {
      useChatThreadStore.getState().setSnapshot(patch);
    }
    this.ensureWorkspaceParentRoute(parentSessionKey);
  };

  openFilePreview = (action: ChatFileOpenActionViewModel) => {
    const parentSessionKey = this.resolveWorkspaceParentSessionKey();
    const nextTab = this.buildWorkspaceFileTab(action, parentSessionKey);
    if (!nextTab) {
      return;
    }
    this.setWorkspaceSelection({
      workspacePanelParentKey: parentSessionKey,
      activeWorkspacePanelKind: 'file',
      workspaceFileTabs: this.upsertWorkspaceFileTab(nextTab),
      activeWorkspaceFileKey: nextTab.key,
      activeChildSessionKey: null,
    }, {
      kind: 'file',
      key: nextTab.key,
    });
    this.ensureWorkspaceParentRoute(parentSessionKey);
  };

  private openSessionFromToolAction = (action: ChatToolActionViewModel) => {
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
    this.closeWorkspacePanel();
    this.uiManager.goToSession(action.sessionId);
  };

  handleToolAction = async (action: ChatToolActionViewModel): Promise<void> => {
    if (action.kind === 'show-content') {
      await this.showContent(action.request);
      return;
    }
    this.openSessionFromToolAction(action);
  };

  private resolvePanelAppEntry = async (value: string): Promise<PanelAppEntryView | null> => {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return null;
    }
    try {
      const { entries } = await nextclawClient.panelApps.listPanelApps();
      return entries.find((entry) => isPanelAppEntryMatch(entry, normalizedValue)) ?? null;
    } catch {
      return null;
    }
  };

  private showContent = async (request: ChatUiShowContentRequest): Promise<void> => {
    if (request.target.type === 'file') {
      this.openFilePreview({
        path: request.target.payload.path,
        label: request.title,
        viewMode: 'preview',
        line: request.target.payload.line,
        column: request.target.payload.column,
      });
      return;
    }
    if (request.target.type === 'url') {
      this.docBrowserManager.open(request.target.payload.url, {
        title: request.title,
      });
      return;
    }
    const entry = await this.resolvePanelAppEntry(request.target.payload.appId);
    if (entry) {
      this.docBrowserManager.openTarget(createPanelAppRightPanelResourceTarget(entry), {
        title: request.title,
      });
      return;
    }
    this.docBrowserManager.open(createPanelAppResourceUri(request.target.payload.appId), {
      title: request.title,
    });
  };

  syncVisibleWorkspaceSelection = (selection: ChatVisibleWorkspaceSelection) => {
    if (selection?.kind === 'child-session') {
      this.sessionListManager.markVisibleWorkspaceChildRead(selection.tab);
    }
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
    this.setWorkspaceSelection({
      activeChildSessionKey: normalizedSessionKey,
      activeWorkspaceFileKey: null,
      activeWorkspacePanelKind: 'child-session',
    }, {
      kind: 'child-session',
      key: normalizedSessionKey,
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
    this.setWorkspaceSelection({
      activeWorkspaceFileKey: normalizedFileKey,
      activeChildSessionKey: null,
      activeWorkspacePanelKind: 'file',
    }, {
      kind: 'file',
      key: normalizedFileKey,
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
    const history = filterNavigationHistoryEntries(
      {
        entries: snapshot.workspaceNavigationHistory,
        index: snapshot.workspaceNavigationHistoryIndex,
      },
      (entry) => entry.kind !== 'file' || entry.key !== normalizedFileKey,
    );
    const nextPatch: Partial<ChatThreadSnapshot> = {
      workspaceFileTabs: nextTabs,
      workspaceNavigationHistory: [...history.entries],
      workspaceNavigationHistoryIndex: history.index,
    };
    if (activeWorkspaceFileKey === normalizedFileKey) {
      const nextSnapshot = {
        ...snapshot,
        workspaceFileTabs: nextTabs,
      };
      const restoreEntry = history.entries[history.index];
      const restorePatch = restoreEntry
        ? this.createWorkspaceSelectionPatch(restoreEntry, nextSnapshot)
        : null;
      Object.assign(nextPatch, restorePatch ?? {
        activeWorkspacePanelKind: null,
        activeWorkspaceFileKey: null,
      });
    }
    useChatThreadStore.getState().setSnapshot(nextPatch);
  };

  closeWorkspacePanel = () => {
    useChatThreadStore.getState().setSnapshot({
      workspacePanelParentKey: null,
      activeWorkspacePanelKind: null,
      activeChildSessionKey: null,
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
    });
  };

  openSessionCronPanel = (sessionKey: string) => {
    const parentSessionKey = sessionKey.trim();
    if (!parentSessionKey) {
      return;
    }
    this.setWorkspaceSelection({
      workspacePanelParentKey: parentSessionKey,
      activeWorkspacePanelKind: 'cron',
      activeChildSessionKey: null,
      activeWorkspaceFileKey: null,
    }, {
      kind: 'cron',
    });
    this.ensureWorkspaceParentRoute(parentSessionKey);
  };

  goBackWorkspacePanel = () => {
    this.restoreWorkspaceNavigationStep('back');
  };

  goForwardWorkspacePanel = () => {
    this.restoreWorkspaceNavigationStep('forward');
  };

  private restoreWorkspaceNavigationStep = (direction: 'back' | 'forward') => {
    const { snapshot } = useChatThreadStore.getState();
    const step = stepNavigationHistory(
      {
        entries: snapshot.workspaceNavigationHistory,
        index: snapshot.workspaceNavigationHistoryIndex,
      },
      direction,
    );
    if (!step) {
      return;
    }
    const selectionPatch = this.createWorkspaceSelectionPatch(step.entry, snapshot);
    if (!selectionPatch) {
      return;
    }
    useChatThreadStore.getState().setSnapshot({
      ...selectionPatch,
      workspaceNavigationHistory: [...step.history.entries],
      workspaceNavigationHistoryIndex: step.history.index,
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
    return viewportLayoutManager.getSnapshot().mode === 'mobile';
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
