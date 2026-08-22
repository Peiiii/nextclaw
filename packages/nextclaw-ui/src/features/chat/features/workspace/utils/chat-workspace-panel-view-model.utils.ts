import type { ResolvedChildSessionTab } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";
import type { ContextMenuGroup } from "@/shared/components/ui/context-menu/context-menu";
import { shouldShowUnreadSessionIndicator } from "@/features/chat/stores/chat-session-list.store";
import type {
  ChatWorkspaceNavigationEntry,
  ChatWorkspacePanelKind,
  ChatWorkspaceFileTab,
  ChatWorkspaceSideChatDraft,
} from "@/features/chat/stores/chat-thread.store";
import { t } from "@/shared/lib/i18n";
import {
  resolveAlternateWorkspaceFileViewer,
  resolveWorkspaceFileViewer,
  type ChatWorkspaceFileViewer,
} from "@/features/chat/features/workspace/utils/chat-workspace-file-viewer.utils";
import { areWorkspaceNavigationEntriesEqual } from "@/features/chat/features/workspace/utils/chat-thread-workspace-session.utils";
import { resolveWorkspaceRelativePath } from "@/shared/lib/session-project";

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
  sessionKey?: string | null;
  fileName?: string | null;
  showUnreadDot?: boolean;
  viewMode?: "preview" | "diff";
  isRenderedPreview?: boolean;
  alternateViewerAction?: {
    label: string;
    viewer: ChatWorkspaceFileViewer;
    onSelect: () => void;
  } | null;
  onAddToChat?: () => void;
  onSelect: () => void;
  onClose?: () => void;
  menuLabel?: string;
  menuGroups?: readonly ContextMenuGroup[];
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

type WorkspaceTabsViewModelParams = {
  hasSession: boolean;
  resolvedChildTabs: ResolvedChildSessionTab[];
  activeSideChatDraft: ChatWorkspaceSideChatDraft | null;
  closedWorkspaceTabEntries: readonly ChatWorkspaceNavigationEntry[];
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
  activeSelection: WorkspaceSelection | null;
  optimisticReadAtBySessionKey: Record<string, string>;
  sessionProjectRoot?: string | null;
  onAddFileToChat?: (reference: { label: string; tokenKey: string }) => void;
  onSelectSession: (sessionKey: string) => void;
  onSelectFile: (fileKey: string) => void;
  onOpenFileViewer: (fileKey: string, viewer: ChatWorkspaceFileViewer) => void;
  onCloseTab: (entry: ChatWorkspaceNavigationEntry) => void;
  onSelectOverview: () => void;
  onSelectChildSessions: () => void;
  onSelectProjectFiles: () => void;
  onSelectCronJobs: () => void;
};

function buildWorkspacePageTabs({
  activeSelection,
  hasSession,
  onSelectChildSessions,
  onSelectCronJobs,
  onSelectOverview,
  onSelectProjectFiles,
}: Pick<
  WorkspaceTabsViewModelParams,
  | "activeSelection"
  | "hasSession"
  | "onSelectChildSessions"
  | "onSelectCronJobs"
  | "onSelectOverview"
  | "onSelectProjectFiles"
>): WorkspaceTabViewModel[] {
  const pageTabs: WorkspaceTabViewModel[] = [
    {
      key: "overview",
      kind: "overview",
      title: t("chatWorkspaceOverview"),
      tooltip: t("chatWorkspaceOverview"),
      active: activeSelection?.kind === "overview",
      onSelect: onSelectOverview,
    },
    {
      key: "child-sessions",
      kind: "child-sessions",
      title: t("chatWorkspaceChildSessions"),
      tooltip: t("chatWorkspaceChildSessions"),
      active: activeSelection?.kind === "child-sessions",
      onSelect: onSelectChildSessions,
    },
    {
      key: "cron:session",
      kind: "cron",
      title: t("chatWorkspaceSessionCronJobs"),
      tooltip: t("chatWorkspaceSessionCronJobs"),
      active: activeSelection?.kind === "cron",
      onSelect: onSelectCronJobs,
    },
    {
      key: "project-files",
      kind: "project-files",
      title: t("chatWorkspaceProjectFiles"),
      tooltip: t("chatWorkspaceProjectFiles"),
      active: activeSelection?.kind === "project-files",
      onSelect: onSelectProjectFiles,
    },
  ];
  return hasSession
    ? pageTabs
    : pageTabs.filter((tab) => tab.kind === "project-files");
}

export function buildWorkspaceTabsViewModel(
  params: WorkspaceTabsViewModelParams,
): WorkspaceTabViewModel[] {
  const {
    hasSession,
    activeSideChatDraft,
    closedWorkspaceTabEntries,
    resolvedChildTabs,
    workspaceFileTabs,
    activeSelection,
    optimisticReadAtBySessionKey,
    sessionProjectRoot,
    onAddFileToChat,
    onSelectSession,
    onSelectFile,
    onOpenFileViewer,
    onCloseTab,
    onSelectOverview,
    onSelectChildSessions,
    onSelectProjectFiles,
    onSelectCronJobs,
  } = params;

  const workspacePages = buildWorkspacePageTabs({
    activeSelection,
    hasSession,
    onSelectChildSessions,
    onSelectCronJobs,
    onSelectOverview,
    onSelectProjectFiles,
  });

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
          onClose: () => onCloseTab({
            kind: "side-chat-draft",
            key: activeSideChatDraft.draftKey,
          }),
        },
      ]
    : [];

  const childTabs = resolvedChildTabs.filter(
    (tab) =>
      !closedWorkspaceTabEntries.some((entry) =>
        areWorkspaceNavigationEntriesEqual(entry, {
          kind: "child-session",
          key: tab.sessionKey,
        }),
      ),
  ).map((tab) => {
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
      sessionKey: tab.sessionKey,
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
      onClose: () => onCloseTab({
        kind: "child-session",
        key: tab.sessionKey,
      }),
    };
  });

  const fileTabs = workspaceFileTabs.map((file) => {
    const viewer = file.viewMode === "preview"
      ? resolveWorkspaceFileViewer(file.path, file.previewViewer)
      : null;
    const alternateViewer = file.viewMode === "preview"
      ? resolveAlternateWorkspaceFileViewer(file.path, file.previewViewer)
      : null;
    const fileTitle = readWorkspaceFileTitle(file);
    const tokenKey = resolveWorkspaceRelativePath({
      path: file.path,
      sessionProjectRoot: sessionProjectRoot ?? null,
    });
    return {
      key: `file:${file.key}`,
      kind: "file" as const,
      title: viewer === "rendered"
        ? `${t("chatWorkspacePreview")}: ${fileTitle}`
        : fileTitle,
      tooltip: file.path,
      fileName: file.path,
      viewMode: file.viewMode,
      isRenderedPreview: viewer === "rendered",
      alternateViewerAction: alternateViewer
        ? {
            label: alternateViewer === "rendered"
              ? t("chatWorkspaceOpenPreview")
              : t("chatWorkspaceOpenSource"),
            viewer: alternateViewer,
            onSelect: () => onOpenFileViewer(file.key, alternateViewer),
          }
        : null,
      onAddToChat: tokenKey && onAddFileToChat
        ? () => onAddFileToChat({ label: fileTitle, tokenKey })
        : undefined,
      active:
        activeSelection?.kind === "file" && activeSelection.file.key === file.key,
      onSelect: () => onSelectFile(file.key),
      onClose: () => onCloseTab({ kind: "file", key: file.key }),
    };
  });

  return [
    ...workspacePages,
    ...sideChatDraftTabs,
    ...childTabs,
    ...fileTabs,
  ];
}
