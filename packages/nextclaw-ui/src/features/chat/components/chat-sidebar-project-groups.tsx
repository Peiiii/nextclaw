import { useMemo, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatSessionTypeOptionItem } from "./chat-session-type-option-item";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ChatInputSnapshot } from '@/components/chat/stores/chat-input.store';
import type { NcpSessionListItemView } from '@/features/chat/hooks/use-ncp-session-list-view';
import { t } from '@/lib/i18n';

export type ChatSidebarProjectGroup = {
  projectRoot: string;
  projectName: string;
  items: NcpSessionListItemView[];
  latestUpdatedAt: number;
};

type SessionTypeOption = ChatInputSnapshot['sessionTypeOptions'][number];

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
                  className="truncate text-[11px] font-medium uppercase tracking-wider text-gray-500"
                  title={group.projectRoot}
                >
                  {group.projectName}
                </div>
                <span className="shrink-0 text-[10px] text-gray-400">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 rounded-lg text-gray-400 hover:bg-white hover:text-gray-900"
                      aria-label={actionLabel}
                      title={actionLabel}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-56 rounded-2xl border border-gray-200/80 bg-white p-1.5 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
                  >
                    <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                      {t('chatSessionTypeLabel')}
                    </div>
                    <div className="space-y-1">
                      {sessionTypeOptions.map((option) => (
                        <ChatSessionTypeOptionItem
                          key={`${group.projectRoot}:${option.value}`}
                          option={option}
                          onSelect={() => {
                            onCreateSession(option.value, group.projectRoot);
                            setOpenProjectRoot(null);
                          }}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 rounded-lg text-gray-400 hover:bg-white hover:text-gray-900"
                  onClick={() => onCreateSession(preferredSessionType, group.projectRoot)}
                  aria-label={actionLabel}
                  title={actionLabel}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
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
