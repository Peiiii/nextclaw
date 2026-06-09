import type { ReactNode } from "react";
import { MessageSquareText } from "lucide-react";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import type {
  ChatSidebarDateGroup,
  ChatSidebarProjectGroup,
} from "@/features/chat/features/session/utils/chat-sidebar-session-groups.utils";
import { ChatSidebarProjectGroups } from "@/features/chat/features/session/components/chat-sidebar-project-groups";
import type { ChatInputSnapshot } from "@/features/chat/stores/chat-input.store";
import { t } from "@/shared/lib/i18n";

type SessionTypeOption = ChatInputSnapshot["sessionTypeOptions"][number];

type ChatSidebarSessionListProps = {
  isLoading: boolean;
  isProjectFirstView: boolean;
  groups: ChatSidebarDateGroup[];
  projectGroups: ChatSidebarProjectGroup[];
  defaultSessionType: string;
  sessionTypeOptions: SessionTypeOption[];
  renderSessionItem: (item: NcpSessionListItemView) => ReactNode;
  onCreateSession: (sessionType: string, projectRoot?: string | null) => void;
};

function ChatSidebarEmptyState({ label }: { label: string }) {
  return (
    <div className="p-4 text-center">
      <MessageSquareText className="mx-auto mb-2 h-6 w-6 text-gray-300" />
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

export function ChatSidebarSessionList({
  defaultSessionType,
  groups,
  isLoading,
  isProjectFirstView,
  onCreateSession,
  projectGroups,
  renderSessionItem,
  sessionTypeOptions,
}: ChatSidebarSessionListProps) {
  if (isLoading) {
    return <div className="p-3 text-xs text-gray-500">{t("sessionsLoading")}</div>;
  }

  if (isProjectFirstView) {
    return projectGroups.length === 0 ? (
      <ChatSidebarEmptyState label={t("chatSidebarProjectViewEmpty")} />
    ) : (
      <ChatSidebarProjectGroups
        groups={projectGroups}
        defaultSessionType={defaultSessionType}
        sessionTypeOptions={sessionTypeOptions}
        renderSessionItem={renderSessionItem}
        onCreateSession={onCreateSession}
      />
    );
  }

  if (groups.length === 0) {
    return <ChatSidebarEmptyState label={t("sessionsEmpty")} />;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            {group.label}
          </div>
          <div className="space-y-0.5">{group.items.map(renderSessionItem)}</div>
        </div>
      ))}
    </div>
  );
}
