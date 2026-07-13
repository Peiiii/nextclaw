import type { ResolvedChildSessionTab } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";
import { shouldShowUnreadSessionIndicator } from "@/features/chat/stores/chat-session-list.store";
import type {
  ChatWorkspacePanelKind,
  ChatWorkspaceFileTab,
  ChatWorkspaceSideChatDraft,
} from "@/features/chat/stores/chat-thread.store";
import { t } from "@/shared/lib/i18n";

export type WorkspaceSelection =
  | {
      kind: "overview";
    }
  | {
      kind: "child-sessions";
    }
  | {
      kind: "child-session";
      tab: ResolvedChildSessionTab;
    }
  | {
      kind: "side-chat-draft";
      draft: ChatWorkspaceSideChatDraft;
    }
  | {
      kind: "project-files";
    }
  | {
      kind: "file";
      file: ChatWorkspaceFileTab;
    }
  | {
      kind: "cron";
    };

export type WorkspaceTabViewModel = {
  key: string;
  kind: ChatWorkspacePanelKind;
  title: string;
  tooltip: string;
  active: boolean;
  agentId?: string | null;
  showUnreadDot?: boolean;
  viewMode?: "preview" | "diff";
  onSelect: () => void;
  onClose?: () => void;
};

export function readWorkspaceFileTitle(file: ChatWorkspaceFileTab): string {
  const fileName = file.path.split("/").filter(Boolean).pop();
  return file.label?.trim() || fileName || file.path;
}

export function resolveWorkspaceSelection(params: {
  activePanelKind?: ChatWorkspacePanelKind | null;
  activeChildSessionKey: string | null;
  activeSideChatDraft: ChatWorkspaceSideChatDraft | null;
  activeWorkspaceFileKey: string | null;
  childSessionTabs: ResolvedChildSessionTab[];
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
}): WorkspaceSelection | null {
  const {
    activePanelKind,
    activeChildSessionKey,
    activeSideChatDraft,
    activeWorkspaceFileKey,
    childSessionTabs,
    workspaceFileTabs,
  } = params;

  if (activePanelKind === "overview") {
    return { kind: "overview" };
  }

  if (activePanelKind === "child-sessions") {
    return { kind: "child-sessions" };
  }

  if (activePanelKind === "project-files") {
    return { kind: "project-files" };
  }

  if (activePanelKind === "cron") {
    return { kind: "cron" };
  }

  if (activePanelKind === "side-chat-draft" && activeSideChatDraft) {
    return {
      kind: "side-chat-draft",
      draft: activeSideChatDraft,
    };
  }

  if (activePanelKind !== "child-session" && activeWorkspaceFileKey) {
    const activeFile = workspaceFileTabs.find(
      (file) => file.key === activeWorkspaceFileKey,
    );
    if (activeFile) {
      return {
        kind: "file",
        file: activeFile,
      };
    }
  }

  if (activePanelKind !== "file" && activeChildSessionKey) {
    const activeChild = childSessionTabs.find(
      (tab) => tab.sessionKey === activeChildSessionKey,
    );
    if (activeChild) {
      return {
        kind: "child-session",
        tab: activeChild,
      };
    }
  }

  if (childSessionTabs[0]) {
    return {
      kind: "child-session",
      tab: childSessionTabs[0],
    };
  }

  if (activeSideChatDraft) {
    return {
      kind: "side-chat-draft",
      draft: activeSideChatDraft,
    };
  }

  if (workspaceFileTabs[0]) {
    return {
      kind: "file",
      file: workspaceFileTabs[0],
    };
  }

  return null;
}

export function buildWorkspaceTabsViewModel(params: {
  resolvedChildTabs: ResolvedChildSessionTab[];
  activeSideChatDraft: ChatWorkspaceSideChatDraft | null;
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
  activeSelection: WorkspaceSelection | null;
  optimisticReadAtBySessionKey: Record<string, string>;
  onSelectSession: (sessionKey: string) => void;
  onSelectFile: (fileKey: string) => void;
  onCloseFile: (fileKey: string) => void;
  onSelectOverview: () => void;
  onSelectChildSessions: () => void;
  onSelectProjectFiles: () => void;
  onSelectCronJobs: () => void;
}): WorkspaceTabViewModel[] {
  const {
    activeSideChatDraft,
    resolvedChildTabs,
    workspaceFileTabs,
    activeSelection,
    optimisticReadAtBySessionKey,
    onSelectSession,
    onSelectFile,
    onCloseFile,
    onSelectOverview,
    onSelectChildSessions,
    onSelectProjectFiles,
    onSelectCronJobs,
  } = params;

  const workspacePages = [
    {
      key: "overview",
      kind: "overview" as const,
      title: t("chatWorkspaceOverview"),
      tooltip: t("chatWorkspaceOverview"),
      active: activeSelection?.kind === "overview",
      onSelect: onSelectOverview,
    },
    {
      key: "child-sessions",
      kind: "child-sessions" as const,
      title: t("chatWorkspaceChildSessions"),
      tooltip: t("chatWorkspaceChildSessions"),
      active: activeSelection?.kind === "child-sessions",
      onSelect: onSelectChildSessions,
    },
    {
      key: "cron:session",
      kind: "cron" as const,
      title: t("chatWorkspaceSessionCronJobs"),
      tooltip: t("chatWorkspaceSessionCronJobs"),
      active: activeSelection?.kind === "cron",
      onSelect: onSelectCronJobs,
    },
    {
      key: "project-files",
      kind: "project-files" as const,
      title: t("chatWorkspaceProjectFiles"),
      tooltip: t("chatWorkspaceProjectFiles"),
      active: activeSelection?.kind === "project-files",
      onSelect: onSelectProjectFiles,
    },
  ];

  const sideChatDraftTabs = activeSideChatDraft
    ? [
        {
          key: `side-chat-draft:${activeSideChatDraft.draftKey}`,
          kind: "side-chat-draft" as const,
          title: t("chatWorkspaceSideChatDraftTitle"),
          tooltip: t("chatWorkspaceSideChatDraftSubtitle"),
          active:
            activeSelection?.kind === "side-chat-draft" &&
            activeSelection.draft.draftKey === activeSideChatDraft.draftKey,
          onSelect: () => undefined,
        },
      ]
    : [];

  const childTabs = resolvedChildTabs.map((tab) => {
    const optimisticReadAt = optimisticReadAtBySessionKey[tab.sessionKey];
    const effectiveReadAt =
      optimisticReadAt && tab.readAt
        ? optimisticReadAt.localeCompare(tab.readAt) > 0
          ? optimisticReadAt
          : tab.readAt
        : (optimisticReadAt ?? tab.readAt);

    return {
      key: `child:${tab.sessionKey}`,
      kind: "child-session" as const,
      title: tab.title,
      tooltip: tab.title,
      agentId: tab.agentId,
      active:
        activeSelection?.kind === "child-session" &&
        activeSelection.tab.sessionKey === tab.sessionKey,
      showUnreadDot: shouldShowUnreadSessionIndicator({
        active:
          activeSelection?.kind === "child-session" &&
          activeSelection.tab.sessionKey === tab.sessionKey,
        lastMessageAt: tab.lastMessageAt,
        readAt: effectiveReadAt,
        runStatus: tab.runStatus,
      }),
      onSelect: () => onSelectSession(tab.sessionKey),
    };
  });

  const fileTabs = workspaceFileTabs.map((file) => ({
    key: `file:${file.key}`,
    kind: "file" as const,
    title: readWorkspaceFileTitle(file),
    tooltip: file.path,
    viewMode: file.viewMode,
    active:
      activeSelection?.kind === "file" && activeSelection.file.key === file.key,
    onSelect: () => onSelectFile(file.key),
    onClose: () => onCloseFile(file.key),
  }));

  return [
    ...workspacePages,
    ...sideChatDraftTabs,
    ...childTabs,
    ...fileTabs,
  ];
}
