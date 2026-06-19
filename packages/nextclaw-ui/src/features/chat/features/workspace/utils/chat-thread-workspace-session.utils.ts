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
  if (current.kind === 'cron') {
    return true;
  }
  return next.kind !== 'cron' && current.key === next.key;
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
