import { useState, type ReactNode } from "react";
import { ChatCollapsibleContent } from "@nextclaw/agent-chat-ui";
import { ChevronRight, MessageSquareText } from "lucide-react";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import type {
  ChatSidebarDateGroup,
  ChatSidebarProjectGroup,
} from "@/features/chat/features/session/utils/chat-sidebar-session-groups.utils";
import { ChatSidebarProjectGroups } from "@/features/chat/features/session/components/chat-sidebar-project-groups";
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type SessionTypeOption = ChatSessionTypeOption;

type ChatSidebarSessionListProps = {
  variant?: 'desktop' | 'mobile';
  isLoading: boolean;
  isProjectFirstView: boolean;
  groups: ChatSidebarDateGroup[];
  projectGroups: ChatSidebarProjectGroup[];
  projectCronJobCountByRoot: ReadonlyMap<string, number>;
  defaultSessionType: string;
  sessionTypeOptions: SessionTypeOption[];
  renderSessionItem: (item: NcpSessionListItemView) => ReactNode;
};

function ChatSidebarEmptyState({ label }: { label: string }) {
  return (
    <div className="p-4 text-center">
      <MessageSquareText className="mx-auto mb-2 h-6 w-6 text-muted-foreground/45" />
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ChatSidebarSessionGroup({ group, variant, renderSessionItem }: {
  group: ChatSidebarDateGroup;
  variant: 'desktop' | 'mobile';
  renderSessionItem: ChatSidebarSessionListProps['renderSessionItem'];
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'group/session-heading flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl text-left text-xs font-medium text-muted-foreground outline-none transition-colors duration-base hover:bg-[var(--interaction-hover)] hover:text-foreground',
          variant === 'mobile' ? 'min-h-9 px-4' : 'min-h-7 px-2',
        )}
      >
        <span className="truncate">{group.label}</span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'h-3 w-3 shrink-0 opacity-0 transition-[opacity,transform] duration-200 group-hover/session-heading:opacity-100 motion-reduce:transition-none',
            open && 'rotate-90',
          )}
        />
      </button>
      <ChatCollapsibleContent open={open}>{() => (
        <div className={variant === 'mobile' ? undefined : 'space-y-0.5'}>
          {group.items.map(renderSessionItem)}
        </div>
      )}</ChatCollapsibleContent>
    </div>
  );
}

export function ChatSidebarSessionList({
  variant = 'desktop',
  defaultSessionType,
  groups,
  isLoading,
  isProjectFirstView,
  projectGroups,
  projectCronJobCountByRoot,
  renderSessionItem,
  sessionTypeOptions,
}: ChatSidebarSessionListProps) {
  if (isLoading) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        {t("sessionsLoading")}
      </div>
    );
  }

  if (isProjectFirstView) {
    return projectGroups.length === 0 ? (
      <ChatSidebarEmptyState label={t("chatSidebarProjectViewEmpty")} />
    ) : (
      <ChatSidebarProjectGroups
        groups={projectGroups}
        projectCronJobCountByRoot={projectCronJobCountByRoot}
        defaultSessionType={defaultSessionType}
        sessionTypeOptions={sessionTypeOptions}
        renderSessionItem={renderSessionItem}
      />
    );
  }

  if (groups.length === 0) {
    return <ChatSidebarEmptyState label={t("sessionsEmpty")} />;
  }

  return (
    <div className={variant === 'mobile' ? undefined : 'space-y-2'}>
      {groups.map((group) => (
        <ChatSidebarSessionGroup
          key={group.label}
          group={group}
          variant={variant}
          renderSessionItem={renderSessionItem}
        />
      ))}
    </div>
  );
}
