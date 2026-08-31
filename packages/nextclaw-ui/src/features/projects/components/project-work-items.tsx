import { useState } from "react";
import type {
  ObservedWorkItem,
  ProjectObservationSnapshot,
} from "@nextclaw/client-sdk";
import { Button } from "@/shared/components/ui/button";
import { t } from "@/shared/lib/i18n";
import {
  createProjectBoardColumns,
  getScheduledWorkItems,
  getUnstagedWorkItems,
  type ProjectWorkView,
} from "@/features/projects/presenters/project-home.presenter";
import { ProjectEmptyState } from "./project-section";
import { ProjectRuns } from "./project-runs";

function WorkItemCard({
  item,
  onSelect,
}: {
  item: ObservedWorkItem;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full rounded-xl bg-card p-3 text-left text-sm shadow-sm hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
      onClick={onSelect}
    >
      <span className="block font-medium">{item.name}</span>
      <span className="mt-1 block text-xs text-muted-foreground">
        {item.reference.label} · {t(`projectsStatus_${item.status}`)}
      </span>
    </button>
  );
}

function ProjectWorkItemsEmptyState({
  hasProjectSessions,
  onStartObservationSetup,
  onStartProjectWork,
  shouldOfferObservationSetup,
}: {
  hasProjectSessions: boolean;
  onStartObservationSetup: () => void;
  onStartProjectWork: () => void;
  shouldOfferObservationSetup: boolean;
}) {
  const messageKey = shouldOfferObservationSetup
    ? "projectsWorkNeedsSetup"
    : hasProjectSessions
      ? "projectsWorkNoReports"
      : "projectsWorkNoSessions";
  return (
    <div className="min-w-0">
      <ProjectEmptyState>{t(messageKey)}</ProjectEmptyState>
      <Button
        size="sm"
        variant="outline"
        onClick={
          shouldOfferObservationSetup
            ? onStartObservationSetup
            : onStartProjectWork
        }
      >
        {t(
          shouldOfferObservationSetup
            ? "projectsObservationSetupAction"
            : "projectsStartProjectWork",
        )}
      </Button>
    </div>
  );
}

export function ProjectWorkItems({
  hasProjectSessions,
  onStartObservationSetup,
  onStartProjectWork,
  snapshot,
  shouldOfferObservationSetup,
}: {
  hasProjectSessions: boolean;
  onStartObservationSetup: () => void;
  onStartProjectWork: () => void;
  snapshot: ProjectObservationSnapshot;
  shouldOfferObservationSetup: boolean;
}) {
  const [view, setView] = useState<ProjectWorkView>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    snapshot.workItems.find((item) => item.id === selectedId) ?? null;
  const columns = createProjectBoardColumns(
    snapshot.workflows,
    snapshot.workItems,
  );
  const unstaged = getUnstagedWorkItems(snapshot.workItems);
  const scheduled = getScheduledWorkItems(snapshot.workItems);
  return (
    <section className="min-w-0" aria-label={t("projectsWork")}>
      {(snapshot.runs?.length ?? 0) > 0 ? (
        <div className="mb-5">
          <h2 className="mb-2 text-sm font-semibold">{t("projectsAiActivity")}</h2>
          <ProjectRuns snapshot={snapshot} />
        </div>
      ) : null}
      {snapshot.workItems.length === 0 ? (
        <ProjectWorkItemsEmptyState
          hasProjectSessions={hasProjectSessions}
          onStartObservationSetup={onStartObservationSetup}
          onStartProjectWork={onStartProjectWork}
          shouldOfferObservationSetup={shouldOfferObservationSetup}
        />
      ) : (
      <>
      <div
        className="mb-4 flex flex-wrap gap-1"
        role="group"
        aria-label={t("projectsWorkViews")}
      >
        {(["list", "board", "gantt"] as const).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={view === key ? "secondary" : "ghost"}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {t(`projectsWork${key[0].toUpperCase()}${key.slice(1)}`)}
          </Button>
        ))}
      </div>
      {view === "list" ? (
        <div className="space-y-2">
          {snapshot.workItems.map((item) => (
            <WorkItemCard
              key={item.id}
              item={item}
              onSelect={() => setSelectedId(item.id)}
            />
          ))}
        </div>
      ) : null}
      {view === "board" ? (
        columns.length ? (
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((column) => (
              <section
                key={column.id}
                className="min-w-0 rounded-xl bg-muted/35 p-3"
              >
                <h3 className="mb-3 text-xs font-semibold">{column.label}</h3>
                <div className="space-y-2">
                  {column.items.map((item) => (
                    <WorkItemCard
                      key={item.id}
                      item={item}
                      onSelect={() => setSelectedId(item.id)}
                    />
                  ))}
                  {!column.items.length ? (
                    <p className="py-3 text-xs text-muted-foreground">
                      {t("projectsNoData")}
                    </p>
                  ) : null}
                </div>
              </section>
            ))}
            {unstaged.length ? (
              <section className="min-w-0 rounded-xl bg-muted/35 p-3">
                <h3 className="mb-3 text-xs font-semibold">
                  {t("projectsUnstaged")}
                </h3>
                <div className="space-y-2">
                  {unstaged.map((item) => (
                    <WorkItemCard
                      key={item.id}
                      item={item}
                      onSelect={() => setSelectedId(item.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <ProjectEmptyState>
            {t("projectsBoardNeedsWorkflow")}
          </ProjectEmptyState>
        )
      ) : null}
      {view === "gantt" ? (
        scheduled.length ? (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <div className="min-w-[42rem] divide-y divide-border/60">
              {scheduled.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="grid w-full grid-cols-[minmax(12rem,1fr)_9rem_9rem] gap-3 px-4 py-3 text-left text-sm hover:bg-[var(--interaction-hover)]"
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="truncate font-medium">{item.name}</span>
                  <span>{item.schedule?.start ?? "—"}</span>
                  <span>{item.schedule?.end ?? "—"}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ProjectEmptyState>
            {t("projectsGanttNeedsSchedule")}
          </ProjectEmptyState>
        )
      ) : null}
      {selected ? (
        <aside
          className="mt-4 rounded-xl border border-border/60 bg-muted/25 p-4"
          aria-label={t("projectsWorkDetails")}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{selected.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {selected.id} · {selected.reference.label}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedId(null)}
            >
              {t("projectsCloseDetails")}
            </Button>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("projectsStatus")}
              </dt>
              <dd>{t(`projectsStatus_${selected.status}`)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("projectsStage")}
              </dt>
              <dd>{selected.stageId ?? t("projectsNoData")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("projectsUpdated")}
              </dt>
              <dd>{selected.updatedAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("projectsSchedule")}
              </dt>
              <dd>
                {selected.schedule
                  ? `${selected.schedule.start ?? "—"} → ${selected.schedule.end ?? "—"}`
                  : t("projectsNoData")}
              </dd>
            </div>
          </dl>
        </aside>
      ) : null}
      </>
      )}
    </section>
  );
}
