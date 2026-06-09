import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { NcpMessage } from '@nextclaw/ncp';
import type { ChatFileOperationLineViewModel } from '@nextclaw/agent-chat-ui';
import type {
  SessionContextWindowView,
  SessionTypeIconView
} from '@/shared/lib/api';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';

export type ChatChildSessionTab = {
  sessionKey: string;
  parentSessionKey: string | null;
  label?: string | null;
  agentId?: string | null;
};

export type ChatWorkspaceFileTab = {
  key: string;
  parentSessionKey: string | null;
  path: string;
  label?: string | null;
  viewMode: 'preview' | 'diff';
  line?: number | null;
  column?: number | null;
  rawText?: string | null;
  beforeText?: string | null;
  afterText?: string | null;
  patchText?: string | null;
  oldStartLine?: number | null;
  newStartLine?: number | null;
  fullLines?: ChatFileOperationLineViewModel[];
};

export type ChatWorkspaceNavigationEntry =
  | {
      kind: 'child-session';
      key: string;
    }
  | {
      kind: 'file';
      key: string;
    }
  | {
      kind: 'cron';
    };

export type ChatThreadSnapshot = {
  isProviderStateResolved: boolean;
  modelOptions: ChatModelOption[];
  sessionTypeUnavailable: boolean;
  sessionTypeUnavailableMessage?: string | null;
  sessionTypeLabel?: string | null;
  sessionTypeIcon?: SessionTypeIconView | null;
  sessionKey: string | null;
  agentId?: string | null;
  sessionDisplayName?: string;
  sessionProjectRoot?: string | null;
  sessionWorkingDir?: string | null;
  sessionProjectName?: string | null;
  canDeleteSession: boolean;
  isDeletePending: boolean;
  isHistoryLoading: boolean;
  messages: readonly NcpMessage[];
  isSending: boolean;
  isAwaitingAssistantOutput: boolean;
  hasSubmittedDraftMessage: boolean;
  parentSessionKey?: string | null;
  parentSessionLabel?: string | null;
  workspacePanelParentKey?: string | null;
  activeWorkspacePanelKind?: "child-session" | "file" | "cron" | null;
  childSessionTabs: ChatChildSessionTab[];
  activeChildSessionKey?: string | null;
  workspaceFileTabs: ChatWorkspaceFileTab[];
  activeWorkspaceFileKey?: string | null;
  workspaceNavigationHistory: ChatWorkspaceNavigationEntry[];
  workspaceNavigationHistoryIndex: number;
  contextWindow?: SessionContextWindowView | null;
};

const CHAT_THREAD_WORKSPACE_STORAGE_KEY = 'nextclaw.chat.workspace-panel.state';
const CHAT_THREAD_WORKSPACE_STORAGE_VERSION = 2;
const CHAT_THREAD_MAX_PERSISTED_WORKSPACE_FILE_TABS = 8;

type ChatThreadStore = {
  snapshot: ChatThreadSnapshot;
  setSnapshot: (patch: Partial<ChatThreadSnapshot>) => void;
};

type PersistedChatThreadStore = {
  snapshot?: {
    workspacePanelParentKey?: unknown;
    activeWorkspacePanelKind?: unknown;
    activeChildSessionKey?: unknown;
    workspaceFileTabs?: unknown;
    activeWorkspaceFileKey?: unknown;
    workspaceNavigationHistory?: unknown;
    workspaceNavigationHistoryIndex?: unknown;
  };
};

type PersistedChatWorkspaceSnapshot = Pick<
  ChatThreadSnapshot,
  | 'workspacePanelParentKey'
  | 'activeWorkspacePanelKind'
  | 'activeChildSessionKey'
  | 'workspaceFileTabs'
  | 'activeWorkspaceFileKey'
  | 'workspaceNavigationHistory'
  | 'workspaceNavigationHistoryIndex'
>;

const initialSnapshot: ChatThreadSnapshot = {
  isProviderStateResolved: false,
  modelOptions: [],
  sessionTypeUnavailable: false,
  sessionTypeUnavailableMessage: null,
  sessionTypeLabel: null,
  sessionTypeIcon: null,
  sessionKey: null,
  agentId: null,
  sessionDisplayName: undefined,
  sessionProjectRoot: null,
  sessionWorkingDir: null,
  sessionProjectName: null,
  canDeleteSession: false,
  isDeletePending: false,
  isHistoryLoading: false,
  messages: [],
  isSending: false,
  isAwaitingAssistantOutput: false,
  hasSubmittedDraftMessage: false,
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
  contextWindow: null
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null;
}

function normalizeHistoryIndex(value: unknown, maxIndex: number): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.min(Math.max(0, value), maxIndex)
    : maxIndex;
}

function isWorkspacePanelKind(
  value: unknown,
): value is NonNullable<ChatThreadSnapshot['activeWorkspacePanelKind']> {
  return value === 'child-session' || value === 'file' || value === 'cron';
}

function normalizePersistedWorkspaceNavigationEntry(
  value: unknown,
): ChatWorkspaceNavigationEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.kind === 'cron') {
    return { kind: 'cron' };
  }
  const key = normalizeOptionalString(value.key);
  if (!key || (value.kind !== 'child-session' && value.kind !== 'file')) {
    return null;
  }
  return {
    kind: value.kind,
    key,
  };
}

function createWorkspaceNavigationEntryFromSnapshot({
  activeChildSessionKey,
  activeWorkspaceFileKey,
  activeWorkspacePanelKind,
}: {
  activeWorkspacePanelKind: ChatThreadSnapshot['activeWorkspacePanelKind'];
  activeChildSessionKey: string | null;
  activeWorkspaceFileKey: string | null;
}): ChatWorkspaceNavigationEntry | null {
  if (activeWorkspacePanelKind === 'cron') {
    return { kind: 'cron' };
  }
  if (activeWorkspacePanelKind === 'child-session' && activeChildSessionKey) {
    return {
      kind: 'child-session',
      key: activeChildSessionKey,
    };
  }
  if (activeWorkspacePanelKind === 'file' && activeWorkspaceFileKey) {
    return {
      kind: 'file',
      key: activeWorkspaceFileKey,
    };
  }
  return null;
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizePersistedWorkspaceFileTab(
  value: unknown,
): ChatWorkspaceFileTab | null {
  if (
    !isRecord(value)
    || typeof value.key !== 'string'
    || typeof value.path !== 'string'
    || (value.viewMode !== 'preview' && value.viewMode !== 'diff')
  ) {
    return null;
  }
  const key = value.key.trim();
  const path = value.path.trim();
  if (!key || !path) {
    return null;
  }
  return {
    key,
    parentSessionKey: normalizeOptionalString(value.parentSessionKey),
    path,
    label: normalizeOptionalString(value.label),
    viewMode: value.viewMode,
    line: normalizeOptionalNumber(value.line),
    column: normalizeOptionalNumber(value.column),
    rawText: normalizeOptionalText(value.rawText),
    beforeText: normalizeOptionalText(value.beforeText),
    afterText: normalizeOptionalText(value.afterText),
    patchText: normalizeOptionalText(value.patchText),
    oldStartLine: normalizeOptionalNumber(value.oldStartLine),
    newStartLine: normalizeOptionalNumber(value.newStartLine),
  };
}

function toPersistedWorkspaceFileTab(
  tab: ChatWorkspaceFileTab,
): ChatWorkspaceFileTab {
  return {
    key: tab.key,
    parentSessionKey: tab.parentSessionKey,
    path: tab.path,
    label: tab.label,
    viewMode: tab.viewMode,
    line: tab.line,
    column: tab.column,
    rawText: tab.rawText,
    beforeText: tab.beforeText,
    afterText: tab.afterText,
    patchText: tab.patchText,
    oldStartLine: tab.oldStartLine,
    newStartLine: tab.newStartLine,
  };
}

function normalizePersistedWorkspaceSnapshot(
  value: unknown,
): PersistedChatWorkspaceSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  const workspaceFileTabs = Array.isArray(value.workspaceFileTabs)
    ? value.workspaceFileTabs
      .map(normalizePersistedWorkspaceFileTab)
      .filter((tab): tab is ChatWorkspaceFileTab => tab !== null)
      .slice(-CHAT_THREAD_MAX_PERSISTED_WORKSPACE_FILE_TABS)
    : [];
  const activeWorkspaceFileKey = normalizeOptionalString(value.activeWorkspaceFileKey);
  const resolvedActiveWorkspaceFileKey =
    activeWorkspaceFileKey && workspaceFileTabs.some((tab) => tab.key === activeWorkspaceFileKey)
      ? activeWorkspaceFileKey
      : workspaceFileTabs[0]?.key ?? null;
  const activeWorkspacePanelKind = isWorkspacePanelKind(value.activeWorkspacePanelKind)
    ? value.activeWorkspacePanelKind
    : null;
  const resolvedActiveWorkspacePanelKind =
    activeWorkspacePanelKind === 'file' && !resolvedActiveWorkspaceFileKey
      ? null
      : activeWorkspacePanelKind;
  const activeChildSessionKey = normalizeOptionalString(value.activeChildSessionKey);
  const fallbackHistoryEntry = createWorkspaceNavigationEntryFromSnapshot({
    activeWorkspacePanelKind: resolvedActiveWorkspacePanelKind,
    activeChildSessionKey,
    activeWorkspaceFileKey: resolvedActiveWorkspaceFileKey,
  });
  const normalizedNavigationHistory = Array.isArray(value.workspaceNavigationHistory)
    ? value.workspaceNavigationHistory
      .map(normalizePersistedWorkspaceNavigationEntry)
      .filter((entry): entry is ChatWorkspaceNavigationEntry => entry !== null)
      .filter((entry) =>
        entry.kind !== 'file' || workspaceFileTabs.some((tab) => tab.key === entry.key),
      )
    : [];
  const workspaceNavigationHistory =
    normalizedNavigationHistory.length > 0
      ? normalizedNavigationHistory
      : fallbackHistoryEntry
        ? [fallbackHistoryEntry]
        : [];
  const workspaceNavigationHistoryIndex =
    workspaceNavigationHistory.length > 0
      ? normalizeHistoryIndex(
        value.workspaceNavigationHistoryIndex,
        workspaceNavigationHistory.length - 1,
      )
      : 0;

  return {
    workspacePanelParentKey: normalizeOptionalString(value.workspacePanelParentKey),
    activeWorkspacePanelKind: resolvedActiveWorkspacePanelKind,
    activeChildSessionKey,
    workspaceFileTabs,
    activeWorkspaceFileKey: resolvedActiveWorkspaceFileKey,
    workspaceNavigationHistory,
    workspaceNavigationHistoryIndex,
  };
}

export const useChatThreadStore = create<ChatThreadStore>()(
  persist(
    (set) => ({
      snapshot: initialSnapshot,
      setSnapshot: (patch) =>
        set((state) => ({
          snapshot: {
            ...state.snapshot,
            ...patch
          }
        }))
    }),
    {
      name: CHAT_THREAD_WORKSPACE_STORAGE_KEY,
      version: CHAT_THREAD_WORKSPACE_STORAGE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state): PersistedChatThreadStore => ({
        snapshot: {
          workspacePanelParentKey: state.snapshot.workspacePanelParentKey,
          activeWorkspacePanelKind: state.snapshot.activeWorkspacePanelKind,
          activeChildSessionKey: state.snapshot.activeChildSessionKey,
          workspaceFileTabs: state.snapshot.workspaceFileTabs
            .slice(-CHAT_THREAD_MAX_PERSISTED_WORKSPACE_FILE_TABS)
            .map(toPersistedWorkspaceFileTab),
          activeWorkspaceFileKey: state.snapshot.activeWorkspaceFileKey,
          workspaceNavigationHistory: state.snapshot.workspaceNavigationHistory,
          workspaceNavigationHistoryIndex: state.snapshot.workspaceNavigationHistoryIndex,
        }
      }),
      merge: (persistedState, currentState) => {
        const persistedSnapshot = isRecord(persistedState)
          ? persistedState.snapshot
          : null;
        const workspaceSnapshot =
          normalizePersistedWorkspaceSnapshot(persistedSnapshot);
        if (!workspaceSnapshot) {
          return currentState;
        }
        return {
          ...currentState,
          snapshot: {
            ...currentState.snapshot,
            ...workspaceSnapshot
          }
        };
      }
    }
  )
);
