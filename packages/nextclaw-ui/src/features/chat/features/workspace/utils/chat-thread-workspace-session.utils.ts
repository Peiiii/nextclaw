import type {
  ChatChildSessionTab,
  ChatThreadSnapshot,
  ChatWorkspaceNavigationEntry,
  ChatWorkspaceSideChatDraft,
} from "@/features/chat/stores/chat-thread.store";
import {
  filterNavigationHistoryEntries,
  pushNavigationHistoryEntry,
} from "@/shared/lib/navigation-history";

export function areWorkspaceNavigationEntriesEqual(
  current: ChatWorkspaceNavigationEntry,
  next: ChatWorkspaceNavigationEntry,
): boolean {
  if (current.kind !== next.kind) {
    return false;
  }
  if (
    current.kind === 'overview' ||
    current.kind === 'child-sessions' ||
    current.kind === 'project-files' ||
    current.kind === 'cron'
  ) {
    return true;
  }
  return (
    next.kind !== 'overview' &&
    next.kind !== 'child-sessions' &&
    next.kind !== 'project-files' &&
    next.kind !== 'cron' &&
    current.key === next.key
  );
}

export function createWorkspaceNavigationEntryFromSnapshot(
  snapshot: Pick<
    ChatThreadSnapshot,
    'activeChildSessionKey' | 'activeSideChatDraft' | 'activeWorkspaceFileKey' | 'activeWorkspacePanelKind'
  >,
): ChatWorkspaceNavigationEntry | null {
  const {
    activeChildSessionKey,
    activeSideChatDraft,
    activeWorkspaceFileKey,
    activeWorkspacePanelKind,
  } = snapshot;
  if (
    activeWorkspacePanelKind === 'overview' ||
    activeWorkspacePanelKind === 'child-sessions' ||
    activeWorkspacePanelKind === 'project-files' ||
    activeWorkspacePanelKind === 'cron'
  ) {
    return { kind: activeWorkspacePanelKind };
  }
  if (activeWorkspacePanelKind === 'child-session' && activeChildSessionKey) {
    return { kind: 'child-session', key: activeChildSessionKey };
  }
  if (activeWorkspacePanelKind === 'side-chat-draft' && activeSideChatDraft) {
    return { kind: 'side-chat-draft', key: activeSideChatDraft.draftKey };
  }
  return activeWorkspacePanelKind === 'file' && activeWorkspaceFileKey
    ? { kind: 'file', key: activeWorkspaceFileKey }
    : null;
}

export function createWorkspaceSelectionPatch(
  entry: ChatWorkspaceNavigationEntry,
  snapshot: ChatThreadSnapshot,
): Partial<ChatThreadSnapshot> | null {
  if (
    entry.kind === 'overview' ||
    entry.kind === 'child-sessions' ||
    entry.kind === 'project-files'
  ) {
    return {
      activeWorkspacePanelKind: entry.kind,
      activeChildSessionKey: null,
      activeSideChatDraft: null,
      activeWorkspaceFileKey: null,
    };
  }
  if (entry.kind === 'cron') {
    return {
      activeWorkspacePanelKind: 'cron',
      activeChildSessionKey: null,
      activeSideChatDraft: null,
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
      activeSideChatDraft: null,
      activeWorkspaceFileKey: entry.key,
    };
  }
  if (entry.kind === 'side-chat-draft') {
    const { activeSideChatDraft } = snapshot;
    if (activeSideChatDraft?.draftKey !== entry.key) {
      return null;
    }
    return {
      activeWorkspacePanelKind: 'side-chat-draft',
      activeChildSessionKey: null,
      activeSideChatDraft,
      activeWorkspaceFileKey: null,
    };
  }
  return {
    activeWorkspacePanelKind: 'child-session',
    activeChildSessionKey: entry.key,
    activeSideChatDraft: null,
    activeWorkspaceFileKey: null,
  };
}

export function closeWorkspaceTabSnapshot(
  snapshot: ChatThreadSnapshot,
  entry: ChatWorkspaceNavigationEntry,
): Partial<ChatThreadSnapshot> | null {
  if (entry.kind === 'overview') {
    return null;
  }
  const history = filterNavigationHistoryEntries(
    {
      entries: snapshot.workspaceNavigationHistory,
      index: snapshot.workspaceNavigationHistoryIndex,
    },
    (candidate) => !areWorkspaceNavigationEntriesEqual(candidate, entry),
    { kind: 'overview' },
  );
  const shouldRememberClosure = entry.kind !== 'file' && entry.kind !== 'side-chat-draft';
  const patch: Partial<ChatThreadSnapshot> = {
    closedWorkspaceTabEntries: shouldRememberClosure
      ? [
          ...snapshot.closedWorkspaceTabEntries.filter(
            (candidate) => !areWorkspaceNavigationEntriesEqual(candidate, entry),
          ),
          entry,
        ]
      : snapshot.closedWorkspaceTabEntries,
    childSessionTabs: entry.kind === 'child-session'
      ? snapshot.childSessionTabs.filter((tab) => tab.sessionKey !== entry.key)
      : snapshot.childSessionTabs,
    activeSideChatDraft: entry.kind === 'side-chat-draft'
      ? null
      : snapshot.activeSideChatDraft,
    workspaceFileTabs: entry.kind === 'file'
      ? snapshot.workspaceFileTabs.filter((tab) => tab.key !== entry.key)
      : snapshot.workspaceFileTabs,
    workspaceNavigationHistory: [...history.entries],
    workspaceNavigationHistoryIndex: history.index,
  };
  const activeEntry = createWorkspaceNavigationEntryFromSnapshot(snapshot);
  if (!activeEntry || !areWorkspaceNavigationEntriesEqual(activeEntry, entry)) {
    return patch;
  }
  const restoreEntry = history.entries[history.index] ?? { kind: 'overview' };
  const restorePatch = createWorkspaceSelectionPatch(restoreEntry, {
    ...snapshot,
    ...patch,
  });
  return {
    ...patch,
    ...(restorePatch ?? createWorkspaceSelectionPatch({ kind: 'overview' }, snapshot)),
  };
}

export function createSideChatDraft(parentSessionKey: string): ChatWorkspaceSideChatDraft {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return {
    draftKey: `side-chat-draft:${parentSessionKey}:${randomPart}`,
    parentSessionKey,
  };
}

export function upsertChildSessionTab(
  childSessionTabs: readonly ChatChildSessionTab[],
  nextTab: ChatChildSessionTab,
): ChatChildSessionTab[] {
  const existingIndex = childSessionTabs.findIndex((tab) => tab.sessionKey === nextTab.sessionKey);
  if (existingIndex === -1) {
    return [nextTab, ...childSessionTabs];
  }
  const existingTab = childSessionTabs[existingIndex];
  const nextTabs = [...childSessionTabs];
  nextTabs[existingIndex] = {
    ...existingTab,
    parentSessionKey: existingTab.parentSessionKey ?? nextTab.parentSessionKey,
    label: existingTab.label?.trim() ? existingTab.label : nextTab.label,
    agentId: existingTab.agentId?.trim() ? existingTab.agentId : nextTab.agentId,
  };
  return nextTabs;
}

export function materializeSideChatDraftSnapshot(params: {
  snapshot: ChatThreadSnapshot;
  draftKey: string;
  sessionKey: string;
  label?: string | null;
  agentId?: string | null;
}): { patch: Partial<ChatThreadSnapshot>; parentSessionKey: string } | null {
  const {
    agentId: rawAgentId,
    draftKey: rawDraftKey,
    label: rawLabel,
    sessionKey: rawSessionKey,
    snapshot,
  } = params;
  const sessionKey = rawSessionKey.trim();
  const draftKey = rawDraftKey.trim();
  const { activeSideChatDraft } = snapshot;
  if (!sessionKey || !draftKey || activeSideChatDraft?.draftKey !== draftKey) {
    return null;
  }
  const { parentSessionKey } = activeSideChatDraft;
  const filteredHistory = filterNavigationHistoryEntries(
    {
      entries: snapshot.workspaceNavigationHistory,
      index: snapshot.workspaceNavigationHistoryIndex,
    },
    (entry) => entry.kind !== 'side-chat-draft' || entry.key !== draftKey,
  );
  const history = pushNavigationHistoryEntry(
    filteredHistory,
    {
      kind: 'child-session',
      key: sessionKey,
    },
    areWorkspaceNavigationEntriesEqual,
  );
  return {
    parentSessionKey,
    patch: {
      workspacePanelParentKey: parentSessionKey,
      activeWorkspacePanelKind: 'child-session',
      activeChildSessionKey: sessionKey,
      activeSideChatDraft: null,
      activeWorkspaceFileKey: null,
      childSessionTabs: upsertChildSessionTab(snapshot.childSessionTabs, {
        sessionKey,
        parentSessionKey,
        label: rawLabel?.trim() || null,
        agentId: rawAgentId?.trim() || null,
      }),
      workspaceNavigationHistory: [...history.entries],
      workspaceNavigationHistoryIndex: history.index,
    },
  };
}
