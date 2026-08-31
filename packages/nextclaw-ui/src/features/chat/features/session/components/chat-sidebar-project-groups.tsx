import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlarmClock,
  ChevronDown,
  ChevronRight,
  Folder,
  MessageSquareText,
  Pin,
  Plus,
} from "lucide-react";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { ChatSessionTypeMenu } from "@/features/chat/features/session-type/components/chat-session-type-menu";
import { Popover, PopoverTrigger } from "@/shared/components/ui/popover";
import { ChatPopoverContent } from "@/features/chat/components/chat-popover-content";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import type { ChatSidebarProjectGroup } from "@/features/chat/features/session/utils/chat-sidebar-session-groups.utils";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { t } from "@/shared/lib/i18n";
import { ChatSidebarContextCard } from "@/features/chat/features/session/components/chat-sidebar-context-card";
import { SessionRunBadge } from "@/features/chat/features/session/components/session-run-badge";
import { cn } from "@/shared/lib/utils";

export type { ChatSidebarProjectGroup };

type SessionTypeOption = ChatSessionTypeOption;

type ChatSidebarProjectGroupsProps = {
  groups: ChatSidebarProjectGroup[];
  defaultSessionType: string;
  sessionTypeOptions: SessionTypeOption[];
  renderSessionItem: (item: NcpSessionListItemView) => ReactNode;
  projectCronJobCountByRoot: ReadonlyMap<string, number>;
};

function resolveProjectGroupDefaultSessionType(
  defaultSessionType: string,
  sessionTypeOptions: SessionTypeOption[],
): string {
  if (
    sessionTypeOptions.some((option) => option.value === defaultSessionType)
  ) {
    return defaultSessionType;
  }
  return sessionTypeOptions[0]?.value ?? defaultSessionType;
}

export function ChatSidebarProjectGroups(props: ChatSidebarProjectGroupsProps) {
  const {
    groups,
    defaultSessionType,
    sessionTypeOptions,
    renderSessionItem,
    projectCronJobCountByRoot,
  } = props;
  const presenter = usePresenter();
  const location = useLocation();
  const collapsedProjectRoots = useChatSessionListStore(
    (state) => state.snapshot.collapsedProjectRoots,
  );
  const [openProjectRoot, setOpenProjectRoot] = useState<string | null>(null);
  const preferredSessionType = useMemo(
    () =>
      resolveProjectGroupDefaultSessionType(
        defaultSessionType,
        sessionTypeOptions,
      ),
    [defaultSessionType, sessionTypeOptions],
  );
  const supportsSessionTypeChoice = sessionTypeOptions.length > 1;

  return (
    <div className="space-y-0.5">
      {groups.map((group) => {
        const actionLabel = `${t("chatSidebarNewTask")} · ${group.projectName}`;
        const isCollapsed = collapsedProjectRoots.includes(group.projectRoot);
        const hasRunningSession = isCollapsed && group.items.some(
          (item) => item.runStatus === "running",
        );
        const isSelected = Boolean(group.projectId) &&
          location.pathname.startsWith(`/projects/${group.projectId}/`);
        const pinLabel = t(
          group.isPinned ? "chatSidebarUnpinProject" : "chatSidebarPinProject",
        );

        return (
          <div key={group.projectRoot}>
            <div
              className={cn(
                "group/project relative h-8 rounded-lg px-1 text-muted-foreground transition-colors hover:bg-gray-200/60 hover:text-gray-900",
                isSelected && "bg-gray-200/60 text-gray-900",
              )}
            >
              <ChatSidebarContextCard
                title={group.projectName}
                metrics={[
                  {
                    icon: <Folder className="h-3.5 w-3.5" />,
                    label: t("chatSidebarContextPath"),
                    value: group.projectRoot,
                  },
                  {
                    icon: <MessageSquareText className="h-3.5 w-3.5" />,
                    label: t("chatSidebarContextSessions"),
                    value: group.items.length,
                  },
                  {
                    icon: <AlarmClock className="h-3.5 w-3.5" />,
                    label: t("chatSidebarContextScheduledTasks"),
                    value:
                      projectCronJobCountByRoot.get(group.projectRoot) ?? 0,
                  },
                ]}
              >
                <div
                  className={cn(
                    "flex h-full w-full min-w-0 items-center group-hover/project:pr-14 group-has-[[data-project-actions]:focus-within]/project:pr-14",
                    hasRunningSession && "pr-7",
                  )}
                >
                  <IconActionButton
                    icon={
                      isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    }
                    label={t(
                      isCollapsed
                        ? "chatSidebarExpandProject"
                        : "chatSidebarCollapseProject",
                    )}
                    aria-expanded={!isCollapsed}
                    size="sm"
                    tone="surface"
                    tooltip={false}
                    onClick={() =>
                      presenter.chatSessionListManager.toggleProjectCollapsed(
                        group.projectRoot,
                      )
                    }
                  />
                  {group.projectId ? (
                    <Link
                      to={`/projects/${encodeURIComponent(group.projectId)}/overview`}
                      className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                      aria-current={isSelected ? "page" : undefined}
                      title={group.projectRoot}
                    >
                      <Folder
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate text-[13px] font-medium">
                        {group.projectName}
                      </span>
                    </Link>
                  ) : (
                    <span
                      className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left"
                      title={group.projectRoot}
                    >
                      <Folder
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate text-[13px] font-medium">
                        {group.projectName}
                      </span>
                    </span>
                  )}
                </div>
              </ChatSidebarContextCard>
              {hasRunningSession ? (
                <span className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 transition-opacity group-hover/project:opacity-0 group-has-[[data-project-actions]:focus-within]/project:opacity-0">
                  <SessionRunBadge status="running" />
                </span>
              ) : null}
              <div
                data-project-actions
                className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover/project:pointer-events-auto group-hover/project:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
              >
                {supportsSessionTypeChoice ? (
                  <Popover
                    open={openProjectRoot === group.projectRoot}
                    onOpenChange={(nextOpen) => {
                      setOpenProjectRoot(nextOpen ? group.projectRoot : null);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <IconActionButton
                        icon={<Plus className="h-3.5 w-3.5" />}
                        label={actionLabel}
                      />
                    </PopoverTrigger>
                    <ChatPopoverContent
                      align="end"
                      className="w-56 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
                    >
                      <ChatSessionTypeMenu
                        options={sessionTypeOptions}
                        selectedSessionType={preferredSessionType}
                        onSelect={(sessionType) => {
                          presenter.chatSessionListManager.createSession({
                            projectRoot: group.projectRoot,
                            sessionType,
                          });
                          setOpenProjectRoot(null);
                        }}
                      />
                    </ChatPopoverContent>
                  </Popover>
                ) : (
                  <IconActionButton
                    icon={<Plus className="h-3.5 w-3.5" />}
                    label={actionLabel}
                    onClick={() =>
                      presenter.chatSessionListManager.createSession({
                        projectRoot: group.projectRoot,
                        sessionType: preferredSessionType,
                      })
                    }
                  />
                )}
                <IconActionButton
                  icon={
                    <Pin
                      className={
                        group.isPinned
                          ? "h-3.5 w-3.5 fill-current text-foreground"
                          : "h-3.5 w-3.5"
                      }
                    />
                  }
                  label={pinLabel}
                  tooltipSide="right"
                  onClick={() =>
                    presenter.chatSessionListManager.toggleProjectPinned(
                      group.projectRoot,
                    )
                  }
                />
              </div>
            </div>
            {isCollapsed ? null : (
              <div className="mt-0.5 space-y-0.5 pl-2">
                {group.items.map(renderSessionItem)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
