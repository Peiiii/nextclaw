import { appQueryClient } from '@/app-query-client';
import {
  deleteNcpSession as deleteNcpSessionApi,
  deleteNcpSessionSummaryInQueryClient,
} from '@/shared/lib/api';
import type {
  ChatFileOpenActionViewModel,
  ChatUiShowContentRequest,
  ChatToolActionViewModel,
} from '@nextclaw/agent-chat-ui';
import type { UiShowContentEventPayload } from '@nextclaw/shared';
import type { ChatSessionListManager } from '@/features/chat/managers/chat-session-list.manager';
import type { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import type {
  ChatChildSessionTab,
  ChatThreadSnapshot,
  ChatWorkspaceNavigationEntry,
  ChatWorkspacePanelKind,
  ChatWorkspaceFileTab,
} from '@/features/chat/stores/chat-thread.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import { normalizeChatWorkspacePanelWidth } from '@/features/chat/features/workspace/utils/chat-workspace-panel-layout.utils';
import { t } from '@/shared/lib/i18n';
import {
  areWorkspaceNavigationEntriesEqual,
  closeWorkspaceTabSnapshot,
  createWorkspaceSelectionPatch,
  createSideChatDraft,
  materializeSideChatDraftSnapshot,
  upsertChildSessionTab,
} from '@/features/chat/features/workspace/utils/chat-thread-workspace-session.utils';
import {
  pushNavigationHistoryEntry,
  stepNavigationHistory,
} from '@/shared/lib/navigation-history';
import {
  resolveAlternateWorkspaceFileViewer,
  type ChatWorkspaceFileViewer,
} from '@/features/chat/features/workspace/utils/chat-workspace-file-viewer.utils';
import {
  createWorkspaceFileTab,
  upsertWorkspaceFileTab,
} from '@/features/chat/features/workspace/utils/chat-workspace-file-tab.utils';

type WorkspaceChildReadState = Parameters<ChatSessionListManager['markVisibleWorkspaceChildRead']>[0];
export type ChatVisibleWorkspaceSelection =
  | { kind: 'child-session'; tab: WorkspaceChildReadState }
  | { kind: Exclude<ChatWorkspacePanelKind, 'child-session'> }
  | null;

export class ChatThreadManager {
  private readonly handledUiShowContentEventIds = new Set<string>();

  constructor(
    private uiManager: ChatUiManager,
    private sessionListManager: ChatSessionListManager,
    private readonly onWorkspacePanelOpened?: () => void,
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
      sessionDisplayName: undefined,
      sessionProjectRoot: null,
      sessionProjectName: null,
      canDeleteSession: false,
      parentSessionKey: null,
      parentSessionLabel: null,
      workspacePanelParentKey: null,
      activeWorkspacePanelKind: null,
      childSessionTabs: [],
      activeChildSessionKey: null,
      activeSideChatDraft: null,
      workspaceFileTabs: [],
      activeWorkspaceFileKey: null,
      closedWorkspaceTabEntries: [],
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
    });
  };

  private resolveWorkspaceParentSessionKey = (): string | null => {
    const selectedSessionKey = useChatSessionListStore.getState().snapshot.selectedSessionKey?.trim();
    if (selectedSessionKey) {
      return selectedSessionKey;
    }
    const threadSessionKey = useChatThreadStore.getState().snapshot.sessionKey?.trim();
    if (threadSessionKey) {
      return threadSessionKey;
    }
    return useChatSessionListStore.getState().snapshot.selectedSessionKey ?? null;
  };

  private activateWorkspaceFileTab = (
    nextTab: ChatWorkspaceFileTab,
    adjacentToKey?: string,
  ) => {
    const { parentSessionKey } = nextTab;
    const { workspaceFileTabs } = useChatThreadStore.getState().snapshot;
    this.setWorkspaceSelection({
      workspacePanelParentKey: parentSessionKey,
      activeWorkspacePanelKind: 'file',
      workspaceFileTabs: upsertWorkspaceFileTab(
        workspaceFileTabs,
        nextTab,
        adjacentToKey,
      ),
      activeWorkspaceFileKey: nextTab.key,
      activeChildSessionKey: null,
      activeSideChatDraft: null,
    }, {
      kind: 'file',
      key: nextTab.key,
    });
    this.ensureWorkspaceParentRoute(parentSessionKey);
    this.onWorkspacePanelOpened?.();
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
    const closedWorkspaceTabEntries =
      patch.workspacePanelParentKey &&
      patch.workspacePanelParentKey !== snapshot.workspacePanelParentKey
        ? []
        : snapshot.closedWorkspaceTabEntries.filter(
            (candidate) => !areWorkspaceNavigationEntriesEqual(candidate, entry),
          );
    useChatThreadStore.getState().setSnapshot({
      ...patch,
      closedWorkspaceTabEntries,
      workspaceNavigationHistory: [...history.entries],
      workspaceNavigationHistoryIndex: history.index,
    });
  };

  private openWorkspacePage = (
    rawParentSessionKey: string,
    kind: 'overview' | 'child-sessions' | 'project-files' | 'cron',
  ) => {
    const parentSessionKey = rawParentSessionKey.trim();
    if (!parentSessionKey) {
      return;
    }
    this.setWorkspaceSelection({
      workspacePanelParentKey: parentSessionKey,
      activeWorkspacePanelKind: kind,
      activeChildSessionKey: null,
      activeSideChatDraft: null,
      activeWorkspaceFileKey: null,
    }, { kind });
    this.ensureWorkspaceParentRoute(parentSessionKey);
    this.onWorkspacePanelOpened?.();
  };

  openWorkspaceOverview = (sessionKey: string) => {
    this.openWorkspacePage(sessionKey, 'overview');
  };

  toggleWorkspacePanel = (sessionKey: string) => {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey) {
      return;
    }
    const { snapshot } = useChatThreadStore.getState();
    if (
      snapshot.workspacePanelParentKey === normalizedSessionKey &&
      snapshot.activeWorkspacePanelKind
    ) {
      this.closeWorkspacePanel();
      return;
    }
    this.openWorkspaceOverview(normalizedSessionKey);
  };

  setWorkspacePanelWidth = (width: number) => {
    this.syncSnapshot({
      workspacePanelWidth: normalizeChatWorkspacePanelWidth(width),
    });
  };

  openChildSessions = (sessionKey: string) => {
    this.openWorkspacePage(sessionKey, 'child-sessions');
  };

  openProjectFiles = (sessionKey: string) => {
    this.openWorkspacePage(sessionKey, 'project-files');
  };

  openChildSessionPanel = (params: {
    parentSessionKey: string;
    activeChildSessionKey?: string | null;
    childSessionTab?: Pick<ChatChildSessionTab, 'label' | 'agentId'> | null;
  }) => {
    const {
      activeChildSessionKey: rawActiveChildSessionKey,
      childSessionTab,
      parentSessionKey: rawParentSessionKey,
    } = params;
    const parentSessionKey = rawParentSessionKey.trim();
    if (!parentSessionKey) {
      return;
    }
    const activeChildSessionKey = rawActiveChildSessionKey?.trim() || null;
    const patch: Partial<ChatThreadSnapshot> = {
      workspacePanelParentKey: parentSessionKey,
      activeWorkspacePanelKind: 'child-session',
      activeChildSessionKey,
      activeSideChatDraft: null,
      activeWorkspaceFileKey: null,
    };
    if (activeChildSessionKey && childSessionTab) {
      patch.childSessionTabs = upsertChildSessionTab(
        useChatThreadStore.getState().snapshot.childSessionTabs,
        {
          sessionKey: activeChildSessionKey,
          parentSessionKey,
          label: childSessionTab.label?.trim() || null,
          agentId: childSessionTab.agentId?.trim() || null,
        },
      );
    }
    if (activeChildSessionKey) {
      this.setWorkspaceSelection(patch, {
        kind: 'child-session',
        key: activeChildSessionKey,
      });
    } else {
      useChatThreadStore.getState().setSnapshot(patch);
    }
    this.ensureWorkspaceParentRoute(parentSessionKey);
    this.onWorkspacePanelOpened?.();
  };

  openSideChatDraft = (parentSessionKey?: string | null) => {
    const resolvedParentSessionKey =
      parentSessionKey?.trim() || this.resolveWorkspaceParentSessionKey()?.trim();
    if (!resolvedParentSessionKey) {
      return;
    }
    const activeSideChatDraft = createSideChatDraft(resolvedParentSessionKey);
    this.setWorkspaceSelection({
      workspacePanelParentKey: resolvedParentSessionKey,
      activeWorkspacePanelKind: 'side-chat-draft',
      activeChildSessionKey: null,
      activeSideChatDraft,
      activeWorkspaceFileKey: null,
    }, {
      kind: 'side-chat-draft',
      key: activeSideChatDraft.draftKey,
    });
    this.ensureWorkspaceParentRoute(resolvedParentSessionKey);
    this.onWorkspacePanelOpened?.();
  };

  materializeSideChatDraft = (params: {
    draftKey: string;
    sessionKey: string;
    label?: string | null;
    agentId?: string | null;
  }) => {
    const materialized = materializeSideChatDraftSnapshot({
      snapshot: useChatThreadStore.getState().snapshot,
      ...params,
    });
    if (!materialized) {
      return;
    }
    useChatThreadStore.getState().setSnapshot(materialized.patch);
    this.ensureWorkspaceParentRoute(materialized.parentSessionKey);
  };

  openFilePreview = (action: ChatFileOpenActionViewModel) => {
    const parentSessionKey = this.resolveWorkspaceParentSessionKey();
    const nextTab = createWorkspaceFileTab(action, parentSessionKey);
    if (!nextTab) {
      return;
    }
    this.activateWorkspaceFileTab(nextTab);
  };

  openWorkspaceFileViewer = (
    fileKey: string,
    viewer?: ChatWorkspaceFileViewer,
  ) => {
    const sourceTab = useChatThreadStore.getState().snapshot.workspaceFileTabs
      .find((tab) => tab.key === fileKey.trim());
    if (!sourceTab || sourceTab.viewMode !== 'preview') {
      return;
    }
    const nextViewer = viewer ?? resolveAlternateWorkspaceFileViewer(
      sourceTab.path,
      sourceTab.previewViewer,
    );
    if (!nextViewer) {
      return;
    }
    const nextTab = createWorkspaceFileTab({
      path: sourceTab.path,
      label: sourceTab.label ?? undefined,
      viewMode: 'preview',
      previewViewer: nextViewer,
      line: sourceTab.line ?? undefined,
      column: sourceTab.column ?? undefined,
      rawText: sourceTab.rawText ?? undefined,
      contentUrl: sourceTab.contentUrl ?? undefined,
      mimeType: sourceTab.mimeType ?? undefined,
    }, sourceTab.parentSessionKey);
    if (nextTab) {
      this.activateWorkspaceFileTab(nextTab, sourceTab.key);
    }
  };

  private openSessionFromToolAction = (action: ChatToolActionViewModel) => {
    if (action.kind !== 'open-session') {
      return;
    }
    const sessionId = action.sessionId.trim();
    if (!sessionId) {
      return;
    }
    if (action.sessionKind === 'child' && !this.uiManager.isCompactViewport()) {
      const parentSessionKey =
        action.parentSessionId?.trim() ||
        useChatSessionListStore.getState().snapshot.selectedSessionKey ||
        null;
      if (parentSessionKey) {
        this.openChildSessionPanel({
          parentSessionKey,
          activeChildSessionKey: sessionId,
          childSessionTab: {
            label: action.label,
            agentId: action.agentId,
          },
        });
        return;
      }
    }
    this.closeWorkspacePanel();
    this.uiManager.goToSession(sessionId);
  };

  handleToolAction = async (action: ChatToolActionViewModel): Promise<void> => {
    if (action.kind === 'show-content') {
      await this.showContent(action.request);
      return;
    }
    this.openSessionFromToolAction(action);
  };

  handleUiShowContentEvent = async (payload: UiShowContentEventPayload): Promise<void> => {
    const eventId = payload.id.trim();
    if (!eventId || this.handledUiShowContentEventIds.has(eventId)) {
      return;
    }
    this.handledUiShowContentEventIds.add(eventId);
    await this.showContent({
      target: payload.target,
      title: payload.title,
      purpose: payload.purpose,
      placement: payload.placement,
    });
  };

  private showContent = async (request: ChatUiShowContentRequest): Promise<void> => {
    if (request.placement === 'inline') {
      return;
    }
    if (request.target.type === 'file') {
      this.openFilePreview({
        path: request.target.payload.path,
        label: request.title,
        viewMode: 'preview',
        previewViewer: request.target.payload.viewer,
        line: request.target.payload.line,
        column: request.target.payload.column,
      });
      return;
    }
    await this.uiManager.showContent({
      target: request.target,
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
    this.setWorkspaceSelection({
      activeChildSessionKey: normalizedSessionKey,
      activeWorkspaceFileKey: null,
      activeWorkspacePanelKind: 'child-session',
      activeSideChatDraft: null,
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
      activeSideChatDraft: null,
    }, {
      kind: 'file',
      key: normalizedFileKey,
    });
  };

  closeWorkspaceTab = (entry: ChatWorkspaceNavigationEntry) => {
    const { snapshot } = useChatThreadStore.getState();
    const patch = closeWorkspaceTabSnapshot(snapshot, entry);
    if (patch) {
      useChatThreadStore.getState().setSnapshot(patch);
    }
  };

  closeWorkspacePanel = () => {
    useChatThreadStore.getState().setSnapshot({
      workspacePanelParentKey: null,
      activeWorkspacePanelKind: null,
      activeChildSessionKey: null,
      activeSideChatDraft: null,
      activeWorkspaceFileKey: null,
      closedWorkspaceTabEntries: [],
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
    });
  };

  openSessionCronPanel = (sessionKey: string) => {
    this.openWorkspacePage(sessionKey, 'cron');
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
    const selectionPatch = createWorkspaceSelectionPatch(step.entry, snapshot);
    if (!selectionPatch) {
      return;
    }
    useChatThreadStore.getState().setSnapshot({
      ...selectionPatch,
      workspaceNavigationHistory: [...step.history.entries],
      workspaceNavigationHistoryIndex: step.history.index,
    });
  };

  goToParentSession = () => {
    const {
      parentSessionKey,
      activeSideChatDraft,
      childSessionTabs,
      activeChildSessionKey,
    } = useChatThreadStore.getState().snapshot;
    const activeChildParentSessionKey =
      childSessionTabs.find((tab) => tab.sessionKey === activeChildSessionKey)
        ?.parentSessionKey ?? null;
    const resolvedParentSessionKey =
      parentSessionKey ??
      activeSideChatDraft?.parentSessionKey ??
      activeChildParentSessionKey;
    if (!resolvedParentSessionKey) {
      return;
    }
    this.closeWorkspacePanel();
    this.uiManager.goToSession(resolvedParentSessionKey);
  };

  deleteSession = async () => {
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
      this.clearDeletedSessionState(selectedSessionKey);
      this.uiManager.goToChatRoot({ replace: true });
    } finally {
      useChatThreadStore.getState().setSnapshot({ isDeletePending: false });
    }
  };
}
