import { AlarmClock, ArrowLeft, ArrowRight, FileCode2, MessageSquareText, X } from "lucide-react";
import type { WorkspaceTabViewModel } from "@/features/chat/features/workspace/utils/chat-workspace-panel-view-model.utils";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import {
  CompactTabStrip,
  type CompactTabStripAction,
  type CompactTabStripTab,
} from "@/shared/components/ui/tab-strip/compact-tab-strip";
import { t } from "@/shared/lib/i18n";

function WorkspaceTabIcon({ agentId, kind }: Pick<WorkspaceTabViewModel, "agentId" | "kind">) {
  if (kind === "cron") {
    return <AlarmClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
  }

  if (kind === "file") {
    return <FileCode2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
  }

  if (agentId) {
    return (
      <AgentIdentityAvatar agentId={agentId} className="h-3.5 w-3.5 shrink-0" />
    );
  }

  return <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
}

function buildCompactWorkspaceTabs(
  tabs: readonly WorkspaceTabViewModel[],
): CompactTabStripTab[] {
  return tabs.map((tab) => ({
    key: tab.key,
    label: tab.title,
    active: tab.active,
    tooltip: tab.tooltip,
    leadingIcon: <WorkspaceTabIcon kind={tab.kind} agentId={tab.agentId} />,
    badge:
      tab.kind === "file" && tab.viewMode === "diff" ? (
        <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1 py-0 text-[9px] font-medium uppercase tracking-[0.08em] text-amber-700">
          {t("chatWorkspaceDiff")}
        </span>
      ) : null,
    unreadIndicator: tab.showUnreadDot ? <span aria-label={t("chatSessionUnread")} className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null,
    closeLabel: t("chatWorkspaceCloseFile"),
    closePlacement: "leading-hover",
    onSelect: tab.onSelect,
    onClose: tab.onClose,
  }));
}

export function WorkspaceTabsBar({
  canGoBack,
  canGoForward,
  onClose,
  onGoBack,
  onGoForward,
  tabs,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  onClose: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  tabs: readonly WorkspaceTabViewModel[];
}) {
  const compactTabs = buildCompactWorkspaceTabs(tabs);
  const actions: CompactTabStripAction[] = [
    { key: "back", icon: <ArrowLeft className="h-4 w-4" />, label: t("chatWorkspaceBack"), disabled: !canGoBack, onClick: onGoBack },
    { key: "forward", icon: <ArrowRight className="h-4 w-4" />, label: t("chatWorkspaceForward"), disabled: !canGoForward, onClick: onGoForward },
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
