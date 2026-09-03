import { useState } from "react";
import type {
  ProjectWorkItemListEntry,
  ProjectWorkState,
} from "@nextclaw/client-sdk";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDashed,
  CircleX,
  LayoutGrid,
  List,
  Plus,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { t } from "@/shared/lib/i18n";
import {
  sortProjectWorkStates,
  sortProjectWorkStatesForList,
  useProjectWork,
  useProjectWorkActions,
  useProjectWorkEvents,
  useProjectWorkStates,
} from "@/features/projects/hooks/use-project-work";
import { getProjectWorkStateLabel } from "@/features/projects/utils/project-work-state-label.utils";
import { ProjectWorkStateSettings } from "./project-work-state-settings";

function ProjectWorkStateIcon({
  startedProgress,
  state,
}: {
  startedProgress: number | null;
  state: ProjectWorkState;
}) {
  if (state.category === "backlog")
    return (
      <span
        aria-hidden="true"
        data-state-visual="backlog"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/65"
      >
        <CircleDashed className="h-4 w-4" />
      </span>
    );
  if (state.category === "unstarted")
    return (
      <span
        aria-hidden="true"
        data-state-visual="unstarted"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
      >
        <Circle className="h-4 w-4" strokeWidth={2} />
      </span>
    );
  if (state.category === "completed")
    return (
      <span
        aria-hidden="true"
        data-state-visual="completed"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400"
      >
        <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
      </span>
    );
  if (state.category === "canceled")
    return (
      <span
        aria-hidden="true"
        data-state-visual="canceled"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/65"
      >
        <CircleX className="h-4 w-4" />
      </span>
    );
  const progress = Math.round((startedProgress ?? 0.5) * 100);
  const tone =
    progress >= 67
      ? "text-emerald-600 dark:text-emerald-400"
      : progress >= 40
        ? "text-orange-500 dark:text-orange-400"
        : "text-amber-500 dark:text-amber-400";
  return (
    <span
      aria-hidden="true"
      data-state-visual="started"
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center ${tone}`}
    >
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <circle
          cx="8"
          cy="8"
          r="5.5"
          stroke="currentColor"
          strokeWidth="1.75"
          opacity="0.22"
        />
        <circle
          cx="8"
          cy="8"
          r="5.5"
          pathLength="100"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${100 - progress}`}
          transform="rotate(-90 8 8)"
        />
      </svg>
    </span>
  );
}

function WorkItemButton({
  item,
  onOpen,
}: {
  item: ProjectWorkItemListEntry;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full rounded-xl border border-border/50 bg-card p-3 text-left text-sm shadow-sm transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
      onClick={onOpen}
    >
      <span className="block font-medium">{item.title}</span>
      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{getProjectWorkStateLabel(item.state.name)}</span>
        {item.attention !== "none" ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">
            {t(`projectsWorkAttention_${item.attention}`)}
          </span>
        ) : null}
        {item.deletedAt ? <span>{t("projectsDeleted")}</span> : null}
      </span>
    </button>
  );
}

function ProjectWorkStateGroupBody({
  hasNextPage,
  isError,
  isFetchingNextPage,
  isLoading,
  items,
  onLoadMore,
  onOpenWorkItem,
}: {
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  items: ProjectWorkItemListEntry[];
  onLoadMore: () => void;
  onOpenWorkItem: (workItemId: string) => void;
}) {
  if (isLoading)
    return (
      <p className="py-3 text-xs text-muted-foreground">
        {t("projectsLoading")}
      </p>
    );
  if (isError)
    return (
      <p className="py-3 text-xs text-destructive">{t("projectsLoadFailed")}</p>
    );
  return (
    <>
      {items.length ? (
        items.map((item) => (
          <WorkItemButton
            key={item.id}
            item={item}
            onOpen={() => onOpenWorkItem(item.id)}
          />
        ))
      ) : (
        <p className="py-3 text-xs text-muted-foreground">
          {t("projectsNoData")}
        </p>
      )}
      {hasNextPage ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
        >
          {isFetchingNextPage
            ? t("projectsLoading")
            : t("projectsWorkLoadMore")}
        </Button>
      ) : null}
    </>
  );
}

function ProjectWorkStateGroup({
  includeDeleted,
  onOpenWorkItem,
  state,
  startedProgress,
  view,
}: {
  includeDeleted: boolean;
  onOpenWorkItem: (workItemId: string) => void;
  state: ProjectWorkState;
  startedProgress: number | null;
  view: "list" | "board";
}) {
  const [collapsed, setCollapsed] = useState(false);
  const work = useProjectWork(state.projectId, {
    stateId: state.id,
    includeDeleted,
    limit: 20,
  });
  const items = work.data?.pages.flatMap((page) => page.items) ?? [];
  const total = work.data?.pages[0]?.total;
  return (
    <section
      className={
        view === "board"
          ? "flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
          : "min-w-0"
      }
      aria-label={getProjectWorkStateLabel(state.name)}
    >
      <button
        type="button"
        className="flex w-full shrink-0 items-center gap-2 rounded-lg px-1 py-2 text-left transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" />
        )}
        <ProjectWorkStateIcon state={state} startedProgress={startedProgress} />
        <span className="min-w-0 truncate text-sm font-semibold">
          {getProjectWorkStateLabel(state.name)}
        </span>
        <span className="ml-0.5 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {total ?? "…"}
        </span>
      </button>
      {!collapsed ? (
        <div
          className={
            view === "board"
              ? "min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-1 pb-3"
              : "space-y-2 px-1 pb-3"
          }
        >
          <ProjectWorkStateGroupBody
            hasNextPage={work.hasNextPage}
            isError={work.isError}
            isFetchingNextPage={work.isFetchingNextPage}
            isLoading={work.isLoading}
            items={items}
            onLoadMore={() => void work.fetchNextPage()}
            onOpenWorkItem={onOpenWorkItem}
          />
        </div>
      ) : null}
    </section>
  );
}

export function ProjectWorkItems({
  onOpenWorkItem,
  projectId,
}: {
  onOpenWorkItem: (workItemId: string) => void;
  projectId: string;
}) {
  const [view, setView] = useState<"list" | "board">("list");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  useProjectWorkEvents(projectId);
  const states = useProjectWorkStates(projectId);
  const actions = useProjectWorkActions(projectId);
  const create = async () => {
    if (!newTitle.trim()) return;
    try {
      const item = await actions.createItem.mutateAsync({
        title: newTitle.trim(),
      });
      setNewTitle("");
      onOpenWorkItem(item.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("projectsWorkItemCreateFailed"),
      );
    }
  };
  if (states.isLoading)
    return (
      <div className="rounded-xl border border-border/60 p-5 text-sm text-muted-foreground">
        {t("projectsLoading")}
      </div>
    );
  if (states.isError)
    return (
      <div className="rounded-xl border border-destructive/40 p-5 text-sm text-destructive">
        {t("projectsLoadFailed")}
      </div>
    );
  const sortedStates = sortProjectWorkStates(states.data ?? []);
  const listStates = sortProjectWorkStatesForList(states.data ?? []);
  const startedStates = sortedStates.filter(
    (state) => state.category === "started",
  );
  const startedProgressById = new Map(
    startedStates.map((state, index) => [
      state.id,
      (index + 1) / (startedStates.length + 1),
    ]),
  );
  return (
    <section aria-label={t("projectsWork")} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[16rem] flex-1 gap-2">
          <Input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
            }}
            placeholder={t("projectsWorkNewItem")}
          />
          <Button
            onClick={() => void create()}
            disabled={!newTitle.trim() || actions.createItem.isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("projectsCreate")}
          </Button>
        </div>
        <div
          className="flex items-center gap-1 rounded-xl bg-muted/40 p-1"
          role="group"
          aria-label={t("projectsWorkViews")}
        >
          <Button
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List className="mr-2 h-4 w-4" />
            {t("projectsWorkList")}
          </Button>
          <Button
            size="sm"
            variant={view === "board" ? "secondary" : "ghost"}
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            {t("projectsWorkBoard")}
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          {t("projectsWorkStateSettings")}
        </Button>
      </div>
      <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={includeDeleted}
          onChange={(event) => setIncludeDeleted(event.target.checked)}
        />
        {t("projectsWorkShowDeleted")}
      </label>
      {view === "list" ? (
        <div className="space-y-3">
          {listStates.map((state) => (
            <ProjectWorkStateGroup
              key={state.id}
              state={state}
              startedProgress={startedProgressById.get(state.id) ?? null}
              view={view}
              includeDeleted={includeDeleted}
              onOpenWorkItem={onOpenWorkItem}
            />
          ))}
        </div>
      ) : null}
      {view === "board" ? (
        <div className="grid h-[calc(100dvh-17rem)] min-h-[28rem] max-h-[52rem] min-w-0 auto-cols-[minmax(18rem,1fr)] grid-flow-col items-stretch gap-3 overflow-x-auto overflow-y-hidden pb-2">
          {sortedStates.map((state) => (
            <ProjectWorkStateGroup
              key={state.id}
              state={state}
              startedProgress={startedProgressById.get(state.id) ?? null}
              view={view}
              includeDeleted={includeDeleted}
              onOpenWorkItem={onOpenWorkItem}
            />
          ))}
        </div>
      ) : null}
      <ProjectWorkStateSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        projectId={projectId}
        states={sortedStates}
      />
    </section>
  );
}
