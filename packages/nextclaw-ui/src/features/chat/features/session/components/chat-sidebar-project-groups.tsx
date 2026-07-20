import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Folder, Pin, Plus } from 'lucide-react';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { ChatSessionTypeMenu } from "@/features/chat/features/session-type/components/chat-session-type-menu";
import { Popover, PopoverTrigger } from '@/shared/components/ui/popover';
import { ChatPopoverContent } from '@/features/chat/components/chat-popover-content';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import type { NcpSessionListItemView } from '@/features/chat/features/ncp/hooks/use-ncp-session-list-view';
import type { ChatSidebarProjectGroup } from '@/features/chat/features/session/utils/chat-sidebar-session-groups.utils';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { t } from '@/shared/lib/i18n';

export type { ChatSidebarProjectGroup };

type SessionTypeOption = ChatSessionTypeOption;

type ChatSidebarProjectGroupsProps = {
  groups: ChatSidebarProjectGroup[];
  defaultSessionType: string;
  sessionTypeOptions: SessionTypeOption[];
  renderSessionItem: (item: NcpSessionListItemView) => ReactNode;
};

function resolveProjectGroupDefaultSessionType(
  defaultSessionType: string,
  sessionTypeOptions: SessionTypeOption[]
): string {
  if (sessionTypeOptions.some((option) => option.value === defaultSessionType)) {
    return defaultSessionType;
  }
  return sessionTypeOptions[0]?.value ?? defaultSessionType;
}

export function ChatSidebarProjectGroups(props: ChatSidebarProjectGroupsProps) {
  const { groups, defaultSessionType, sessionTypeOptions, renderSessionItem } = props;
  const presenter = usePresenter();
  const collapsedProjectRoots = useChatSessionListStore(
    (state) => state.snapshot.collapsedProjectRoots,
  );
  const [openProjectRoot, setOpenProjectRoot] = useState<string | null>(null);
  const preferredSessionType = useMemo(
    () => resolveProjectGroupDefaultSessionType(defaultSessionType, sessionTypeOptions),
    [defaultSessionType, sessionTypeOptions]
  );
  const supportsSessionTypeChoice = sessionTypeOptions.length > 1;

  return (
    <div className="space-y-0.5">
      {groups.map((group) => {
        const actionLabel = `${t('chatSidebarNewTask')} · ${group.projectName}`;
        const isCollapsed = collapsedProjectRoots.includes(group.projectRoot);
        const pinLabel = t(
          group.isPinned ? 'chatSidebarUnpinProject' : 'chatSidebarPinProject',
        );

        return (
          <div key={group.projectRoot}>
            <div className="group/project relative h-8 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-gray-200/60 hover:text-gray-900">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-label={t(
                  isCollapsed
                    ? 'chatSidebarExpandProject'
                    : 'chatSidebarCollapseProject',
                )}
                className="flex h-full w-full min-w-0 items-center gap-1.5 pr-14 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                onClick={() =>
                  presenter.chatSessionListManager.toggleProjectCollapsed(
                    group.projectRoot,
                  )
                }
              >
                <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span
                  className="truncate text-[11px] font-medium uppercase tracking-wider"
                  title={group.projectRoot}
                >
                  {group.projectName}
                </span>
                {isCollapsed ? (
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span className="shrink-0 text-[10px] text-muted-foreground/70">
                  {group.items.length}
                </span>
              </button>
              <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover/project:pointer-events-auto group-hover/project:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
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
                          ? 'h-3.5 w-3.5 fill-current text-foreground'
                          : 'h-3.5 w-3.5'
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
