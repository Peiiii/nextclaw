import { AlarmClock, ArrowLeft, ArrowRight, FileCode2, MessageSquareText, X } from "lucide-react";
import type { WorkspaceTabViewModel } from "@/features/chat/utils/chat-workspace-panel-view-model.utils";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

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

function WorkspaceTabItem({ tab }: { tab: WorkspaceTabViewModel }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group flex max-w-[180px] min-w-0 items-center gap-1.5 border-r border-gray-200/70 border-b-2 px-2.5 py-2 transition-colors",
            tab.active
              ? "border-b-primary bg-white text-gray-900"
              : "border-b-transparent bg-gray-50/85 text-gray-500 hover:bg-gray-100",
          )}
        >
          {tab.onClose ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                tab.onClose?.();
              }}
              className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
              aria-label={t("chatWorkspaceCloseFile")}
            >
              <span className="flex items-center justify-center group-hover:hidden">
                <WorkspaceTabIcon kind={tab.kind} agentId={tab.agentId} />
              </span>
              <X className="hidden h-3.5 w-3.5 group-hover:block" />
            </button>
          ) : (
            <WorkspaceTabIcon kind={tab.kind} agentId={tab.agentId} />
          )}
          <button
            type="button"
            onClick={tab.onSelect}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <span className="min-w-0 truncate text-[12px] font-medium">
              {tab.title}
            </span>
            {tab.kind === "file" && tab.viewMode === "diff" ? (
              <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1 py-0 text-[9px] font-medium uppercase tracking-[0.08em] text-amber-700">
                {t("chatWorkspaceDiff")}
              </span>
            ) : null}
            {tab.showUnreadDot ? (
              <span
                aria-label={t("chatSessionUnread")}
                className="h-2 w-2 shrink-0 rounded-full bg-primary"
              />
            ) : null}
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[320px] text-xs">
        {tab.tooltip}
      </TooltipContent>
    </Tooltip>
  );
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
  return (
    <TooltipProvider delayDuration={250}>
      <div
        data-testid="workspace-tabs-bar"
        className="flex min-w-0 items-stretch border-b border-gray-200/70 bg-gray-50/85"
      >
        <div className="workspace-horizontal-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div
            data-testid="workspace-tabs-scroll"
            className="flex min-w-max items-stretch"
          >
            {tabs.map((tab) => (
              <WorkspaceTabItem key={tab.key} tab={tab} />
            ))}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-1 inline-flex self-center">
              <button
                type="button"
                onClick={onGoBack}
                disabled={!canGoBack}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                aria-label={t("chatWorkspaceBack")}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t("chatWorkspaceBack")}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex self-center">
              <button
                type="button"
                onClick={onGoForward}
                disabled={!canGoForward}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                aria-label={t("chatWorkspaceForward")}
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t("chatWorkspaceForward")}
          </TooltipContent>
        </Tooltip>
        <button
          type="button"
          onClick={onClose}
          className="mx-1 flex h-7 w-7 shrink-0 self-center items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={t("chatWorkspaceClosePanel")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </TooltipProvider>
  );
}
