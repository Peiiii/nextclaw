import { useMemo, useState } from "react";
import {
  ChevronDown,
  Loader2,
  MessageSquareText,
  Search,
} from "lucide-react";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { useNcpSessionListView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import {
  groupSessionsByDate,
  groupSessionsByProject,
  sortSessionItemsByActivityAtDesc,
} from "@/features/chat/features/session/utils/chat-sidebar-session-groups.utils";
import { ChatSidebarListModeSwitch } from "@/features/chat/components/chat-sidebar-list-mode-switch";
import { buildSessionTypeOptions } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { ChatSessionSwitcherGroups } from "@/features/chat/features/session/components/session-header/chat-session-switcher-groups";
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
import { useProjects } from "@/shared/hooks/use-projects";

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
  const pinnedSessionKeys = useChatSessionListStore(
    (state) => state.snapshot.pinnedSessionKeys,
  );
  const pinnedProjectRoots = useChatSessionListStore(
    (state) => state.snapshot.pinnedProjectRoots,
  );
  const collapsedProjectRoots = useChatSessionListStore(
    (state) => state.snapshot.collapsedProjectRoots,
  );
  const listMode = useChatSessionListStore(
    (state) => state.snapshot.listMode,
  );
  const sessionTypesData = useChatQueryStore(
    (state) => state.snapshot.sessionTypesQuery?.data ?? null,
  );
  const { isLoading, items } = useNcpSessionListView({ query: searchQuery });
  const projectsQuery = useProjects();
  const visibleProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const projects = projectsQuery.data?.projects ?? [];
    if (!query) {
      return projects;
    }
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query) ||
      project.rootPath.toLowerCase().includes(query)
    );
  }, [projectsQuery.data?.projects, searchQuery]);
  const sortedItems = useMemo(
    () => sortSessionItemsByActivityAtDesc(items),
    [items],
  );
  const dateGroups = useMemo(
    () => groupSessionsByDate(sortedItems, new Set(pinnedSessionKeys)),
    [pinnedSessionKeys, sortedItems],
  );
  const projectGroups = useMemo(
    () => groupSessionsByProject(
      sortedItems,
      new Set(pinnedSessionKeys),
      new Set(pinnedProjectRoots),
      visibleProjects,
    ),
    [pinnedProjectRoots, pinnedSessionKeys, sortedItems, visibleProjects],
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
  const sessionListProps = {
    selectedSessionKey,
    optimisticReadAtBySessionKey,
    sessionTypeOptions,
    onSelect: selectSession,
  };
  const isProjectFirstView = listMode === "project-first";
  const hasVisibleGroups = isProjectFirstView
    ? projectGroups.length > 0
    : dateGroups.length > 0;

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
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/75">
              {t("chatSessionSwitcherTitle")}
            </div>
            <ChatSidebarListModeSwitch
              isProjectFirstView={isProjectFirstView}
              onSelectMode={presenter.chatSessionListManager.setListMode}
            />
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
          ) : hasVisibleGroups ? (
            <ChatSessionSwitcherGroups
              collapsedProjectRoots={collapsedProjectRoots}
              dateGroups={dateGroups}
              isProjectFirstView={isProjectFirstView}
              onToggleProjectCollapsed={
                presenter.chatSessionListManager.toggleProjectCollapsed
              }
              projectGroups={projectGroups}
              {...sessionListProps}
            />
          ) : (
            <ChatSessionTitleSwitcherEmptyState
              label={
                searchQuery.trim()
                  ? t("chatSessionSwitcherNoResults")
                  : t(
                      isProjectFirstView
                        ? "chatSidebarProjectViewEmpty"
                        : "sessionsEmpty",
                    )
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
