import { FileCode2, MessageSquareText, X } from "lucide-react";
import type { ResolvedChildSessionTab } from "@/features/chat/hooks/runtime/use-ncp-child-session-tabs-view";
import type { ChatWorkspaceFileTab } from "@/components/chat/stores/chat-thread.store";
import { AgentIdentityAvatar } from "@/components/common/agent-identity";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type WorkspaceSelection =
  | {
      kind: "child-session";
      tab: ResolvedChildSessionTab;
    }
  | {
      kind: "file";
      file: ChatWorkspaceFileTab;
    };

export type WorkspaceTabViewModel = {
  key: string;
  kind: "child-session" | "file";
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
  const label = file.label?.trim();
  if (label) {
    return label;
  }
  return file.path.split("/").filter(Boolean).pop() || file.path;
}

export function resolveWorkspaceSelection(params: {
  activeChildSessionKey: string | null;
  activeWorkspaceFileKey: string | null;
  childSessionTabs: ResolvedChildSessionTab[];
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
}): WorkspaceSelection | null {
  const {
    activeChildSessionKey,
    activeWorkspaceFileKey,
    childSessionTabs,
    workspaceFileTabs,
  } = params;

  if (activeWorkspaceFileKey) {
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

  if (activeChildSessionKey) {
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

  return null;
}

function WorkspaceTabIcon({ agentId, kind }: Pick<WorkspaceTabViewModel, "agentId" | "kind">) {
  if (kind === "file") {
    return <FileCode2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
  }

  if (agentId) {
    return (
      <AgentIdentityAvatar
        agentId={agentId}
        className="h-3.5 w-3.5 shrink-0"
      />
    );
  }

  return <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
}

function WorkspaceTabItem({ tab }: { tab: WorkspaceTabViewModel }) {
  return (
    <TooltipProvider delayDuration={250}>
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
            <button
              type="button"
              onClick={tab.onSelect}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            >
              <WorkspaceTabIcon kind={tab.kind} agentId={tab.agentId} />
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
            {tab.onClose ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  tab.onClose?.();
                }}
                className={cn(
                  "rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700",
                  tab.active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                aria-label={t("chatWorkspaceCloseFile")}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[320px] text-xs">
          {tab.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function WorkspaceTabsBar({
  tabs,
}: {
  tabs: readonly WorkspaceTabViewModel[];
}) {
  return (
    <div
      data-testid="workspace-tabs-bar"
      className="workspace-horizontal-scrollbar overflow-x-auto overflow-y-hidden border-b border-gray-200/70 bg-gray-50/85"
    >
      <div
        data-testid="workspace-tabs-scroll"
        className="flex min-w-max items-stretch"
      >
        {tabs.map((tab) => (
          <WorkspaceTabItem key={tab.key} tab={tab} />
        ))}
      </div>
    </div>
  );
}
