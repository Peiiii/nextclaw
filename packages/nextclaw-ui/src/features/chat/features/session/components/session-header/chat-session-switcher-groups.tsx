import { useId } from "react";
import { Check, ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import { SessionContextIconNode } from "@/features/chat/features/session/components/session-context-icon";
import { SessionRunBadge } from "@/features/chat/features/session/components/session-run-badge";
import type {
  ChatSidebarDateGroup,
  ChatSidebarProjectGroup,
} from "@/features/chat/features/session/utils/chat-sidebar-session-groups.utils";
import {
  formatSessionListTime,
  sessionActivityPreviewText,
  sessionDisplayName,
} from "@/features/chat/features/session/utils/chat-session-display.utils";
import { resolveSessionContextView } from "@/features/chat/features/session/utils/session-context.utils";
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { shouldShowUnreadSessionIndicator } from "@/features/chat/stores/chat-session-list.store";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type SessionSwitchItemsProps = {
  items: NcpSessionListItemView[];
  selectedSessionKey: string | null;
  optimisticReadAtBySessionKey: Record<string, string>;
  sessionTypeOptions: ChatSessionTypeOption[];
  onSelect: (sessionKey: string) => void;
  className?: string;
};

function ChatSessionSwitchItem({
  item,
  selectedSessionKey,
  optimisticReadAtBySessionKey,
  sessionTypeOptions,
  onSelect,
}: Omit<SessionSwitchItemsProps, "items" | "className"> & {
  item: NcpSessionListItemView;
}) {
  const { session, runStatus } = item;
  const active = selectedSessionKey === session.key;
  const optimisticReadAt = optimisticReadAtBySessionKey[session.key];
  const effectiveReadAt =
    optimisticReadAt && session.readAt
      ? optimisticReadAt.localeCompare(session.readAt) > 0
        ? optimisticReadAt
        : session.readAt
      : (optimisticReadAt ?? session.readAt);
  const shouldShowUnread = shouldShowUnreadSessionIndicator({
    active,
    lastMessageAt: session.lastMessageAt,
    readAt: effectiveReadAt,
    runStatus,
  });
  const previewText =
    sessionActivityPreviewText(session) ??
    session.projectName ??
    session.projectRoot ??
    `${session.messageCount}`;
  const trailingText = formatSessionListTime(
    session.lastMessageAt ?? session.createdAt,
  );
  const sessionContext = resolveSessionContextView(session, sessionTypeOptions);

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full min-w-0 items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-accent/65 hover:text-accent-foreground",
      )}
      onClick={() => onSelect(session.key)}
    >
      <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        {shouldShowUnread ? (
          <span
            aria-label={t("chatSidebarUnread")}
            className="h-1.5 w-1.5 rounded-full bg-primary"
          />
        ) : active ? (
          <Check className="h-3 w-3 text-primary" />
        ) : (
          <span className="h-1 w-1 rounded-full bg-muted-foreground/45" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {sessionDisplayName(session)}
          </span>
          {sessionContext.label ? (
            <span className="shrink-0 rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
              {sessionContext.label}
            </span>
          ) : null}
          {sessionContext.icon ? (
            <span className="inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center text-muted-foreground">
              <SessionContextIconNode icon={sessionContext.icon} />
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
          <span className="min-w-0 truncate">{previewText}</span>
          <span className="shrink-0">{trailingText}</span>
        </span>
      </span>
      {runStatus ? (
        <span className="mt-0.5 shrink-0">
          <SessionRunBadge status={runStatus} />
        </span>
      ) : null}
    </button>
  );
}

function ChatSessionSwitchItems({
  items,
  selectedSessionKey,
  optimisticReadAtBySessionKey,
  sessionTypeOptions,
  onSelect,
  className,
}: SessionSwitchItemsProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {items.map((item) => (
        <ChatSessionSwitchItem
          key={item.session.key}
          item={item}
          selectedSessionKey={selectedSessionKey}
          optimisticReadAtBySessionKey={optimisticReadAtBySessionKey}
          sessionTypeOptions={sessionTypeOptions}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function ChatSessionSwitchDateGroup({
  group,
  ...itemsProps
}: Omit<SessionSwitchItemsProps, "items"> & {
  group: ChatSidebarDateGroup;
}) {
  return (
    <section aria-label={group.label}>
      <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {group.label}
      </div>
      <ChatSessionSwitchItems items={group.items} {...itemsProps} />
    </section>
  );
}

function ChatSessionSwitchProjectGroup({
  group,
  isCollapsed,
  onToggleCollapsed,
  ...itemsProps
}: Omit<SessionSwitchItemsProps, "items"> & {
  group: ChatSidebarProjectGroup;
  isCollapsed: boolean;
  onToggleCollapsed: (projectRoot: string) => void;
}) {
  const contentId = useId();
  const actionLabel = `${t(
    isCollapsed ? "chatSidebarExpandProject" : "chatSidebarCollapseProject",
  )} · ${group.projectName}`;

  return (
    <section aria-label={group.projectName}>
      <button
        type="button"
        aria-controls={contentId}
        aria-expanded={!isCollapsed}
        aria-label={actionLabel}
        className="group flex h-10 w-full min-w-0 items-center gap-1.5 rounded-lg px-2 text-left text-muted-foreground transition-colors hover:bg-gray-200/60 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
        onClick={() => onToggleCollapsed(group.projectRoot)}
      >
        <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span
          className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wider"
          title={group.projectRoot}
        >
          {group.projectName}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground/70">
          {group.items.length}
        </span>
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
      </button>
      {isCollapsed ? null : (
        <ChatSessionSwitchItems
          items={group.items}
          className="mt-0.5"
          {...itemsProps}
        />
      )}
    </section>
  );
}

export function ChatSessionSwitcherGroups({
  collapsedProjectRoots,
  dateGroups,
  isProjectFirstView,
  onToggleProjectCollapsed,
  projectGroups,
  ...itemsProps
}: Omit<SessionSwitchItemsProps, "items"> & {
  collapsedProjectRoots: string[];
  dateGroups: ChatSidebarDateGroup[];
  isProjectFirstView: boolean;
  onToggleProjectCollapsed: (projectRoot: string) => void;
  projectGroups: ChatSidebarProjectGroup[];
}) {
  return (
    <div className="space-y-3">
      {isProjectFirstView
        ? projectGroups.map((group) => (
            <ChatSessionSwitchProjectGroup
              key={group.projectRoot}
              group={group}
              isCollapsed={collapsedProjectRoots.includes(group.projectRoot)}
              onToggleCollapsed={onToggleProjectCollapsed}
              {...itemsProps}
            />
          ))
        : dateGroups.map((group) => (
            <ChatSessionSwitchDateGroup
              key={group.label}
              group={group}
              {...itemsProps}
            />
          ))}
    </div>
  );
}
