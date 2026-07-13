import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  MessageSquareText,
  Search,
} from "lucide-react";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import {
  useNcpSessionListView,
  type NcpSessionListItemView,
} from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import { SessionContextIconNode } from "@/features/chat/features/session/components/session-context-icon";
import { SessionRunBadge } from "@/features/chat/features/session/components/session-run-badge";
import {
  formatSessionListTime,
  sessionActivityPreviewText,
  sessionDisplayName,
} from "@/features/chat/features/session/utils/chat-session-display.utils";
import { sortSessionItemsByActivityAtDesc } from "@/features/chat/features/session/utils/chat-sidebar-session-groups.utils";
import { resolveSessionContextView } from "@/features/chat/features/session/utils/session-context.utils";
import {
  buildSessionTypeOptions,
  type ChatSessionTypeOption,
} from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import {
  shouldShowUnreadSessionIndicator,
  useChatSessionListStore,
} from "@/features/chat/stores/chat-session-list.store";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useViewportLayoutStore } from "@/app/stores/viewport-layout.store";
import {
  Popover,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { ChatPopoverContent } from "@/features/chat/components/chat-popover-content";
import { Input } from "@/shared/components/ui/input";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

const SWITCHER_TRIGGER_CLASS =
  "group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border";

function ChatSessionTitle({ title }: { title: string }) {
  return (
    <span className="text-sm font-medium text-foreground truncate">
      {title}
    </span>
  );
}

function ChatSessionTitleSwitcherEmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
      <MessageSquareText className="h-4 w-4 shrink-0 text-muted-foreground/55" />
      <span>{label}</span>
    </div>
  );
}

function ChatSessionTitleSwitcherLoadingState() {
  return (
    <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      <span>{t("sessionsLoading")}</span>
    </div>
  );
}

function ChatSessionSwitchItem({
  item,
  selectedSessionKey,
  optimisticReadAtBySessionKey,
  sessionTypeOptions,
  onSelect,
}: {
  item: NcpSessionListItemView;
  selectedSessionKey: string | null;
  optimisticReadAtBySessionKey: Record<string, string>;
  sessionTypeOptions: ChatSessionTypeOption[];
  onSelect: (sessionKey: string) => void;
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
          : "text-popover-foreground hover:bg-accent/70",
      )}
      onClick={() => onSelect(session.key)}
    >
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {active ? (
          <Check className="h-3.5 w-3.5" />
        ) : shouldShowUnread ? (
          <span
            aria-label={t("chatSessionUnread")}
            className="h-2 w-2 rounded-full bg-primary"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[13px] font-medium">
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

function ChatSessionTitleSwitcherPopover({
  selectedSessionKey,
  title,
}: {
  selectedSessionKey: string | null;
  title: string;
}) {
  const presenter = usePresenter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const optimisticReadAtBySessionKey = useChatSessionListStore(
    (state) => state.optimisticReadAtBySessionKey,
  );
  const sessionTypesData = useChatQueryStore(
    (state) => state.snapshot.sessionTypesQuery?.data ?? null,
  );
  const { isLoading, items } = useNcpSessionListView({ query: searchQuery });
  const sortedItems = useMemo(
    () => sortSessionItemsByActivityAtDesc(items),
    [items],
  );
  const sessionTypeOptions = useMemo(
    () => buildSessionTypeOptions(sessionTypesData?.options ?? []),
    [sessionTypesData?.options],
  );

  const selectSession = (sessionKey: string) => {
    setIsOpen(false);
    setSearchQuery("");
    if (sessionKey === selectedSessionKey) {
      return;
    }
    presenter.chatSessionListManager.selectSession(sessionKey);
  };
  const updateOpen = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearchQuery("");
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={updateOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t("chatSessionSwitch")}: ${title}`}
          aria-expanded={isOpen}
          className={SWITCHER_TRIGGER_CLASS}
        >
          <span className="min-w-0 truncate">{title}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:text-accent-foreground",
              isOpen ? "rotate-180" : null,
            )}
          />
        </button>
      </PopoverTrigger>
      <ChatPopoverContent
        align="start"
        className="w-[22rem] max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="space-y-2 border-b border-border px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/75">
            {t("chatSessionSwitcherTitle")}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/65" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("chatSearchSessionPlaceholder")}
              aria-label={t("chatSearchSessionPlaceholder")}
              className="h-8 rounded-lg bg-background pl-8 pr-2 text-xs"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {isLoading ? (
            <ChatSessionTitleSwitcherLoadingState />
          ) : sortedItems.length > 0 ? (
            <div className="space-y-1">
              {sortedItems.map((item) => (
                <ChatSessionSwitchItem
                  key={item.session.key}
                  item={item}
                  selectedSessionKey={selectedSessionKey}
                  optimisticReadAtBySessionKey={optimisticReadAtBySessionKey}
                  sessionTypeOptions={sessionTypeOptions}
                  onSelect={selectSession}
                />
              ))}
            </div>
          ) : (
            <ChatSessionTitleSwitcherEmptyState
              label={
                searchQuery.trim()
                  ? t("chatSessionSwitcherNoResults")
                  : t("sessionsEmpty")
              }
            />
          )}
        </div>
      </ChatPopoverContent>
    </Popover>
  );
}

export function ChatSessionTitleSwitcher({
  layoutMode,
  selectedSessionKey,
  title,
}: {
  layoutMode: "desktop" | "mobile";
  selectedSessionKey: string | null;
  title: string;
}) {
  const isSidebarCollapsed = useViewportLayoutStore(
    (state) => state.isSidebarCollapsed,
  );

  if (layoutMode !== "desktop" || !isSidebarCollapsed) {
    return <ChatSessionTitle title={title} />;
  }

  return (
    <ChatSessionTitleSwitcherPopover
      selectedSessionKey={selectedSessionKey}
      title={title}
    />
  );
}
