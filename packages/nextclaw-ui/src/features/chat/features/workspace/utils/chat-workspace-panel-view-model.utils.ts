import type { ResolvedChildSessionTab } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";
import { shouldShowUnreadSessionIndicator } from "@/features/chat/stores/chat-session-list.store";
import type { ChatWorkspaceFileTab } from "@/features/chat/stores/chat-thread.store";
import { t } from "@/shared/lib/i18n";

export type WorkspaceSelection =
  | {
      kind: "child-session";
      tab: ResolvedChildSessionTab;
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
  kind: "child-session" | "file" | "cron";
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
  activePanelKind?: "child-session" | "file" | "cron" | null;
  activeChildSessionKey: string | null;
  activeWorkspaceFileKey: string | null;
  childSessionTabs: ResolvedChildSessionTab[];
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
  sessionCronJobCount: number;
}): WorkspaceSelection | null {
  const {
    activePanelKind,
    activeChildSessionKey,
    activeWorkspaceFileKey,
    childSessionTabs,
    workspaceFileTabs,
    sessionCronJobCount,
  } = params;

  if (activePanelKind === "cron" && sessionCronJobCount > 0) {
    return { kind: "cron" };
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

  if (workspaceFileTabs[0]) {
    return {
      kind: "file",
      file: workspaceFileTabs[0],
    };
  }

  if (sessionCronJobCount > 0) {
    return { kind: "cron" };
  }

  return null;
}

export function buildWorkspaceTabsViewModel(params: {
  resolvedChildTabs: ResolvedChildSessionTab[];
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
  sessionCronJobCount: number;
  activeSelection: WorkspaceSelection | null;
  optimisticReadAtBySessionKey: Record<string, string>;
  onSelectSession: (sessionKey: string) => void;
  onSelectFile: (fileKey: string) => void;
  onCloseFile: (fileKey: string) => void;
  onSelectCronJobs: () => void;
}): WorkspaceTabViewModel[] {
  const {
    resolvedChildTabs,
    workspaceFileTabs,
    sessionCronJobCount,
    activeSelection,
    optimisticReadAtBySessionKey,
    onSelectSession,
    onSelectFile,
    onCloseFile,
    onSelectCronJobs,
  } = params;

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

  const cronTab =
    sessionCronJobCount > 0
      ? [
          {
            key: "cron:session",
            kind: "cron" as const,
            title: t("chatWorkspaceSessionCronJobs"),
            tooltip: t("chatWorkspaceSessionCronJobs"),
            active: activeSelection?.kind === "cron",
            onSelect: onSelectCronJobs,
          },
        ]
      : [];

  return [...childTabs, ...fileTabs, ...cronTab];
}
