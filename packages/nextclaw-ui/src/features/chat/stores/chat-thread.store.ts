import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { NcpMessage } from '@nextclaw/ncp';
import type { ChatFileOperationLineViewModel, ChatFilePreviewViewer } from '@nextclaw/agent-chat-ui';
import type {
  SessionContextWindowView,
  SessionTypeIconView
} from '@/shared/lib/api';
import {
  normalizePersistedWorkspaceFileTab,
  retainWorkspaceFileTabs,
  toPersistedWorkspaceFileTab,
} from '@/features/chat/features/workspace/utils/chat-workspace-file-tab-persistence.utils';
import {
  CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH,
  normalizeChatWorkspacePanelWidth,
} from '@/features/chat/features/workspace/utils/chat-workspace-panel-layout.utils';
import { createWorkspaceNavigationEntryFromSnapshot } from '@/features/chat/features/workspace/utils/chat-thread-workspace-session.utils';

export type ChatChildSessionTab = {
  sessionKey: string;
  parentSessionKey: string | null;
  label?: string | null;
  agentId?: string | null;
};

export type ChatWorkspaceSideChatDraft = {
  draftKey: string;
  parentSessionKey: string;
};

export type ChatWorkspaceFileTab = {
  key: string;
  parentSessionKey: string | null;
  path: string;
  label?: string | null;
  viewMode: 'preview' | 'diff';
  previewViewer?: ChatFilePreviewViewer | null;
  line?: number | null;
  column?: number | null;
  rawText?: string | null;
  /** Attachment/binary content URL for workspace-native media preview. */
  contentUrl?: string | null;
  mimeType?: string | null;
  beforeText?: string | null;
  afterText?: string | null;
  patchText?: string | null;
  oldStartLine?: number | null;
  newStartLine?: number | null;
  fullLines?: ChatFileOperationLineViewModel[];
};

export type ChatWorkspacePanelKind =
  | 'overview'
  | 'child-sessions'
  | 'child-session'
  | 'side-chat-draft'
  | 'project-files'
  | 'file'
  | 'cron';

export type ChatWorkspaceNavigationEntry =
  | { kind: 'overview' }
  | { kind: 'child-sessions' }
  | { kind: 'child-session'; key: string }
  | { kind: 'side-chat-draft'; key: string }
  | { kind: 'project-files' }
  | { kind: 'file'; key: string }
  | { kind: 'cron' };

export type ChatThreadSnapshot = {
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
  activeWorkspacePanelKind?: ChatWorkspacePanelKind | null;
  childSessionTabs: ChatChildSessionTab[];
  activeChildSessionKey?: string | null;
  activeSideChatDraft?: ChatWorkspaceSideChatDraft | null;
  workspaceFileTabs: ChatWorkspaceFileTab[];
  activeWorkspaceFileKey?: string | null;
  closedWorkspaceTabEntries: ChatWorkspaceNavigationEntry[];
  workspaceNavigationHistory: ChatWorkspaceNavigationEntry[];
  workspaceNavigationHistoryIndex: number;
  workspacePanelWidth: number;
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
    closedWorkspaceTabEntries?: unknown;
    workspaceNavigationHistory?: unknown;
    workspaceNavigationHistoryIndex?: unknown;
    workspacePanelWidth?: unknown;
  };
};

type PersistedChatWorkspaceSnapshot = Pick<
  ChatThreadSnapshot,
  | 'workspacePanelParentKey'
  | 'activeWorkspacePanelKind'
  | 'activeChildSessionKey'
  | 'workspaceFileTabs'
  | 'activeWorkspaceFileKey'
  | 'closedWorkspaceTabEntries'
  | 'workspaceNavigationHistory'
  | 'workspaceNavigationHistoryIndex'
  | 'workspacePanelWidth'
>;

type PersistedWorkspacePanelKind = Exclude<ChatWorkspacePanelKind, 'side-chat-draft'>;

const initialSnapshot: ChatThreadSnapshot = {
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
  activeSideChatDraft: null,
  workspaceFileTabs: [],
  activeWorkspaceFileKey: null,
  closedWorkspaceTabEntries: [],
  workspaceNavigationHistory: [],
  workspaceNavigationHistoryIndex: 0,
  workspacePanelWidth: CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH,
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

function normalizeHistoryIndex(value: unknown, maxIndex: number): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.min(Math.max(0, value), maxIndex)
    : maxIndex;
}

function isWorkspacePanelKind(
  value: unknown,
): value is PersistedWorkspacePanelKind {
  return (
    value === 'overview' ||
    value === 'child-sessions' ||
    value === 'child-session' ||
    value === 'project-files' ||
    value === 'file' ||
    value === 'cron'
  );
}

function normalizePersistedWorkspaceNavigationEntry(
  value: unknown,
): ChatWorkspaceNavigationEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value.kind === 'overview' ||
    value.kind === 'child-sessions' ||
    value.kind === 'project-files' ||
    value.kind === 'cron'
  ) {
    return { kind: value.kind };
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

function normalizePersistedWorkspaceSnapshot(
  value: unknown,
): PersistedChatWorkspaceSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  const workspacePanelParentKey = normalizeOptionalString(value.workspacePanelParentKey);
  const activeWorkspaceFileKey = normalizeOptionalString(value.activeWorkspaceFileKey);
  const normalizedWorkspaceFileTabs = Array.isArray(value.workspaceFileTabs)
    ? value.workspaceFileTabs
      .map(normalizePersistedWorkspaceFileTab)
      .filter((tab): tab is ChatWorkspaceFileTab => tab !== null)
    : [];
  const workspaceFileTabs = retainWorkspaceFileTabs(
    normalizedWorkspaceFileTabs,
    activeWorkspaceFileKey,
    CHAT_THREAD_MAX_PERSISTED_WORKSPACE_FILE_TABS,
  );
  const sessionWorkspaceFileTabs = workspaceFileTabs.filter(
    (tab) => tab.parentSessionKey === workspacePanelParentKey,
  );
  const resolvedActiveWorkspaceFileKey =
    activeWorkspaceFileKey && sessionWorkspaceFileTabs.some((tab) => tab.key === activeWorkspaceFileKey)
      ? activeWorkspaceFileKey
      : sessionWorkspaceFileTabs[0]?.key ?? null;
  const activeWorkspacePanelKind = isWorkspacePanelKind(value.activeWorkspacePanelKind)
    ? value.activeWorkspacePanelKind
    : null;
  const resolvedActiveWorkspacePanelKind =
    activeWorkspacePanelKind === 'file' && !resolvedActiveWorkspaceFileKey
      ? null
      : activeWorkspacePanelKind;
  const activeChildSessionKey = normalizeOptionalString(value.activeChildSessionKey);
  const closedWorkspaceTabEntries = Array.isArray(value.closedWorkspaceTabEntries)
    ? value.closedWorkspaceTabEntries
      .map(normalizePersistedWorkspaceNavigationEntry)
      .filter((entry): entry is ChatWorkspaceNavigationEntry =>
        entry !== null && entry.kind !== 'overview',
      )
    : [];
  const fallbackHistoryEntry = createWorkspaceNavigationEntryFromSnapshot({
    activeWorkspacePanelKind: resolvedActiveWorkspacePanelKind,
    activeChildSessionKey,
    activeSideChatDraft: null,
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
    workspacePanelParentKey,
    activeWorkspacePanelKind: resolvedActiveWorkspacePanelKind,
    activeChildSessionKey,
    workspaceFileTabs,
    activeWorkspaceFileKey: resolvedActiveWorkspaceFileKey,
    closedWorkspaceTabEntries,
    workspaceNavigationHistory,
    workspaceNavigationHistoryIndex,
    workspacePanelWidth: normalizeChatWorkspacePanelWidth(
      value.workspacePanelWidth,
    ),
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
      partialize: (state): PersistedChatThreadStore => {
        const workspaceNavigationHistory = state.snapshot.workspaceNavigationHistory
          .filter((entry) => entry.kind !== 'side-chat-draft');
        const workspaceNavigationHistoryIndex =
          workspaceNavigationHistory.length > 0
            ? Math.min(
              state.snapshot.workspaceNavigationHistoryIndex,
              workspaceNavigationHistory.length - 1,
            )
            : 0;
        return {
          snapshot: {
            workspacePanelParentKey: state.snapshot.workspacePanelParentKey,
            activeWorkspacePanelKind:
              state.snapshot.activeWorkspacePanelKind === 'side-chat-draft'
                ? null
                : state.snapshot.activeWorkspacePanelKind,
            activeChildSessionKey: state.snapshot.activeChildSessionKey,
            workspaceFileTabs: retainWorkspaceFileTabs(
              state.snapshot.workspaceFileTabs,
              state.snapshot.activeWorkspaceFileKey,
              CHAT_THREAD_MAX_PERSISTED_WORKSPACE_FILE_TABS,
            )
              .map(toPersistedWorkspaceFileTab),
            activeWorkspaceFileKey: state.snapshot.activeWorkspaceFileKey,
            closedWorkspaceTabEntries: state.snapshot.closedWorkspaceTabEntries
              .filter((entry) => entry.kind !== 'overview' && entry.kind !== 'side-chat-draft'),
            workspaceNavigationHistory,
            workspaceNavigationHistoryIndex,
            workspacePanelWidth: state.snapshot.workspacePanelWidth,
          }
        };
      },
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
