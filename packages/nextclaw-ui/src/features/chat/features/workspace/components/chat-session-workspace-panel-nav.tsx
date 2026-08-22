import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  Code2,
  Copy,
  Eye,
  FolderTree,
  GitBranch,
  LayoutDashboard,
  Maximize2,
  MessageSquarePlus,
  MessageSquareText,
  Minimize2,
  RefreshCw,
  X,
} from "lucide-react";
import type { WorkspaceTabViewModel } from "@/features/chat/features/workspace/utils/chat-workspace-panel-view-model.utils";
import { copySessionId } from "@/features/chat/features/session/components/session-header/chat-session-more-actions-menu";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import { FileTypeIcon } from "@/shared/components/file-type-icon";
import {
  CompactTabStrip,
  type CompactTabStripAction,
  type CompactTabStripTab,
} from "@/shared/components/ui/tab-strip/compact-tab-strip";
import type {
  ContextMenuGroup,
  ContextMenuItem,
} from "@/shared/components/ui/context-menu/context-menu";
import { t } from "@/shared/lib/i18n";

function WorkspaceTabIcon({
  agentId,
  fileName,
  kind,
}: Pick<WorkspaceTabViewModel, "agentId" | "fileName" | "kind">) {
  if (kind === "overview") {
    return <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
  }

  if (kind === "child-sessions") {
    return <GitBranch className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
  }

  if (kind === "project-files") {
    return <FolderTree className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
  }

  if (kind === "cron") {
    return <AlarmClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
  }

  if (kind === "file") {
    return <FileTypeIcon fileName={fileName ?? ""} size="compact" />;
  }

  if (kind === "side-chat-draft") {
    return <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-primary" />;
  }

  if (agentId) {
    return (
      <AgentIdentityAvatar agentId={agentId} className="h-3.5 w-3.5 shrink-0" />
    );
  }

  return <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
}

function buildWorkspaceFileMenuGroups(
  tab: WorkspaceTabViewModel,
): ContextMenuGroup[] | undefined {
  if (tab.kind !== "file") {
    return undefined;
  }

  const fileActions: ContextMenuItem[] = [
    ...(tab.onAddToChat
      ? [{
          key: "add-to-chat",
          icon: <MessageSquarePlus className="h-4 w-4" />,
          label: t("chatWorkspaceAddToChat"),
          restoreFocus: false,
          onSelect: tab.onAddToChat,
        }]
      : []),
    ...(tab.alternateViewerAction
      ? [{
          key: `viewer:${tab.alternateViewerAction.viewer}`,
          icon: tab.alternateViewerAction.viewer === "rendered"
            ? <Eye className="h-4 w-4" />
            : <Code2 className="h-4 w-4" />,
          label: tab.alternateViewerAction.label,
          onSelect: tab.alternateViewerAction.onSelect,
        }]
      : []),
  ];
  const tabActions: ContextMenuItem[] = tab.onClose
    ? [{
        key: "close",
        icon: <X className="h-4 w-4" />,
        label: t("chatWorkspaceCloseFile"),
        onSelect: tab.onClose,
      }]
    : [];

  return [
    { key: "file", items: fileActions },
    { key: "tab", items: tabActions },
  ];
}

function buildWorkspaceSessionMenuGroups(
  tab: WorkspaceTabViewModel,
): ContextMenuGroup[] | undefined {
  if (tab.kind !== "child-session" || !tab.sessionKey) {
    return undefined;
  }

  return [
    {
      key: "session",
      items: [
        {
          key: "copy-session-id",
          label: t("chatSessionCopyId"),
          icon: <Copy className="h-4 w-4" />,
          onSelect: () => void copySessionId(tab.sessionKey!),
        },
      ],
    },
  ];
}

function buildCompactWorkspaceTabs(
  tabs: readonly WorkspaceTabViewModel[],
): CompactTabStripTab[] {
  return tabs.map((tab) => ({
    key: tab.key,
    label: tab.title,
    labelClassName: tab.isRenderedPreview ? "italic font-normal" : undefined,
    active: tab.active,
    tooltip: tab.tooltip,
    leadingIcon: (
      <WorkspaceTabIcon
        kind={tab.kind}
        agentId={tab.agentId}
        fileName={tab.fileName}
      />
    ),
    badge: tab.kind === "file" && tab.viewMode === "diff" ? (
        <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1 py-0 text-[9px] font-medium uppercase tracking-[0.08em] text-amber-700">
          {t("chatWorkspaceDiff")}
        </span>
      ) : null,
    unreadIndicator: tab.showUnreadDot ? <span aria-label={t("chatSessionUnread")} className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null,
    closeLabel: `${
      tab.kind === "file"
        ? t("chatWorkspaceCloseFile")
        : t("chatWorkspaceCloseTab")
    }: ${tab.title}`,
    closePlacement: "leading-hover",
    onSelect: tab.onSelect,
    onClose: tab.onClose,
    menuLabel:
      tab.kind === "child-session"
        ? t("chatSessionMoreActions")
        : t("chatWorkspaceFileMoreActions"),
    menuGroups:
      tab.menuGroups ??
      buildWorkspaceSessionMenuGroups(tab) ??
      buildWorkspaceFileMenuGroups(tab),
  }));
}

export function WorkspaceTabsBar({
  canGoBack,
  canGoForward,
  isMaximized = false,
  onClose,
  onGoBack,
  onGoForward,
  onRefreshFile,
  onToggleMaximize,
  tabs,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  isMaximized?: boolean;
  onClose: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onRefreshFile?: () => void;
  onToggleMaximize?: () => void;
  tabs: readonly WorkspaceTabViewModel[];
}) {
  const compactTabs = buildCompactWorkspaceTabs(tabs);
  const actions: CompactTabStripAction[] = [
    { key: "back", icon: <ArrowLeft className="h-4 w-4" />, label: t("chatWorkspaceBack"), disabled: !canGoBack, onClick: onGoBack },
    { key: "forward", icon: <ArrowRight className="h-4 w-4" />, label: t("chatWorkspaceForward"), disabled: !canGoForward, onClick: onGoForward },
    ...(onRefreshFile
      ? [
          {
            key: "refresh-file",
            icon: <RefreshCw className="h-4 w-4" />,
            label: t("chatWorkspaceRefreshFile"),
            onClick: onRefreshFile,
          },
        ]
      : []),
    ...(onToggleMaximize
      ? [
          {
            key: "maximize",
            icon: isMaximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            ),
            label: isMaximized
              ? t("chatWorkspaceRestorePanel")
              : t("chatWorkspaceMaximizePanel"),
            onClick: onToggleMaximize,
          },
        ]
      : []),
    { key: "close", icon: <X className="h-4 w-4" />, label: t("chatWorkspaceClosePanel"), onClick: onClose },
  ];

  return (
    <CompactTabStrip
      testId="workspace-tabs-bar"
      scrollTestId="workspace-tabs-scroll"
      tabs={compactTabs}
      actions={actions}
      scrollClassName="workspace-horizontal-scrollbar"
      actionsClassName="ml-1 mr-1 self-stretch"
    />
  );
}
