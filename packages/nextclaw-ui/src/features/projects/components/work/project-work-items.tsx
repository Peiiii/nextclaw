import { useState } from "react";
import type { ProjectWorkItemDetail } from "@nextclaw/client-sdk";
import { LayoutGrid, List, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { t } from "@/shared/lib/i18n";
import {
  useProjectWork,
  useProjectWorkActions,
} from "@/features/projects/hooks/use-project-work";
import { getProjectWorkStateLabel } from "@/features/projects/utils/project-work-state-label.utils";
import { ProjectWorkStateSettings } from "./project-work-state-settings";

function WorkItemButton({
  item,
  onOpen,
}: {
  item: ProjectWorkItemDetail;
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
  const work = useProjectWork(projectId, includeDeleted);
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
  if (work.isLoading)
    return (
      <div className="rounded-xl border border-border/60 p-5 text-sm text-muted-foreground">
        {t("projectsLoading")}
      </div>
    );
  if (work.isError)
    return (
      <div className="rounded-xl border border-destructive/40 p-5 text-sm text-destructive">
        {t("projectsLoadFailed")}
      </div>
    );
  const data = work.data!;
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
      {!data.items.length ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          {t("projectsWorkEmpty")}
        </div>
      ) : null}
      {view === "list" && data.items.length ? (
        <div className="space-y-2">
          {data.items.map((item) => (
            <WorkItemButton
              key={item.id}
              item={item}
              onOpen={() => onOpenWorkItem(item.id)}
            />
          ))}
        </div>
      ) : null}
      {view === "board" && data.items.length ? (
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.states.map((state) => {
            const items = data.items.filter(
              (item) => item.stateId === state.id,
            );
            return (
              <section
                key={state.id}
                className="min-w-0 rounded-xl bg-muted/35 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {getProjectWorkStateLabel(state.name)}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <WorkItemButton
                      key={item.id}
                      item={item}
                      onOpen={() => onOpenWorkItem(item.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      <ProjectWorkStateSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        projectId={projectId}
        states={data.states}
      />
    </section>
  );
}
