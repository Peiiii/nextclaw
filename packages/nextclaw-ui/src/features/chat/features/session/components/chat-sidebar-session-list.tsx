import type { ReactNode } from "react";
import { MessageSquareText } from "lucide-react";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import type {
  ChatSidebarDateGroup,
  ChatSidebarProjectGroup,
} from "@/features/chat/features/session/utils/chat-sidebar-session-groups.utils";
import { ChatSidebarProjectGroups } from "@/features/chat/features/session/components/chat-sidebar-project-groups";
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { t } from "@/shared/lib/i18n";

type SessionTypeOption = ChatSessionTypeOption;

type ChatSidebarSessionListProps = {
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

export function ChatSidebarSessionList({
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
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/65">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map(renderSessionItem)}
          </div>
        </div>
      ))}
    </div>
  );
}
