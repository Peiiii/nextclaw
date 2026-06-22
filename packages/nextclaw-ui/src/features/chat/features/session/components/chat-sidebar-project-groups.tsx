import { useMemo, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { ChatSessionTypeMenu } from "@/features/chat/features/session-type/components/chat-session-type-menu";
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import type { NcpSessionListItemView } from '@/features/chat/features/ncp/hooks/use-ncp-session-list-view';
import type { ChatSidebarProjectGroup } from '@/features/chat/features/session/utils/chat-sidebar-session-groups.utils';
import { t } from '@/shared/lib/i18n';

export type { ChatSidebarProjectGroup };

type SessionTypeOption = ChatSessionTypeOption;

type ChatSidebarProjectGroupsProps = {
  groups: ChatSidebarProjectGroup[];
  defaultSessionType: string;
  sessionTypeOptions: SessionTypeOption[];
  renderSessionItem: (item: NcpSessionListItemView) => ReactNode;
  onCreateSession: (sessionType: string, projectRoot: string) => void;
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
  const { groups, defaultSessionType, sessionTypeOptions, renderSessionItem, onCreateSession } = props;
  const [openProjectRoot, setOpenProjectRoot] = useState<string | null>(null);
  const preferredSessionType = useMemo(
    () => resolveProjectGroupDefaultSessionType(defaultSessionType, sessionTypeOptions),
    [defaultSessionType, sessionTypeOptions]
  );
  const supportsSessionTypeChoice = sessionTypeOptions.length > 1;

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const actionLabel = `${t('chatSidebarNewTask')} · ${group.projectName}`;

        return (
          <div key={group.projectRoot}>
            <div className="flex items-center justify-between gap-2 px-2 py-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <div
                  className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                  title={group.projectRoot}
                >
                  {group.projectName}
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground/70">
                  {group.items.length}
                </span>
              </div>
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
                      tooltip={false}
                      className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-56 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
                  >
                    <ChatSessionTypeMenu
                      options={sessionTypeOptions}
                      selectedSessionType={preferredSessionType}
                      onSelect={(sessionType) => {
                        onCreateSession(sessionType, group.projectRoot);
                        setOpenProjectRoot(null);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <IconActionButton
                  icon={<Plus className="h-3.5 w-3.5" />}
                  label={actionLabel}
                  className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => onCreateSession(preferredSessionType, group.projectRoot)}
                />
              )}
            </div>
            <div className="space-y-0.5 pl-2">
              {group.items.map(renderSessionItem)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
