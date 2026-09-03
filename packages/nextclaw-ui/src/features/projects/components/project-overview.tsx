import { formatDateTime, t } from "@/shared/lib/i18n";
import {
  useProjectRecentArtifacts,
  useProjectWork,
  useProjectWorkEvents,
  useProjectWorkSummary,
} from "@/features/projects/hooks/use-project-work";
import { getProjectWorkStateLabel } from "@/features/projects/utils/project-work-state-label.utils";
import { formatProjectRelativeTime } from "@/features/projects/utils/project-artifact-view.utils";
import {
  ProjectEmptyState,
  ProjectFilePreviewButton,
  ProjectSection,
} from "./project-section";

export function ProjectOverview({
  projectId,
  onOpenArtifact,
  onOpenWorkItem,
}: {
  projectId: string;
  onOpenArtifact: (path: string, label: string) => void;
  onOpenWorkItem: (workItemId: string) => void;
}) {
  useProjectWorkEvents(projectId);
  const summary = useProjectWorkSummary(projectId);
  const work = useProjectWork(projectId, { limit: 5 });
  const artifacts = useProjectRecentArtifacts(projectId, 5);
  const recent =
    work.data?.pages.flatMap((page) => page.items).slice(0, 5) ?? [];
  return (
    <div className="space-y-5">
      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label={t("projectsWorkSummary")}
      >
        {summary.data ? (
          (
            [
              ["projectsWorkTotal", summary.data!.total],
              ["projectsWorkActive", summary.data!.active],
              ["projectsWorkNeedsAttention", summary.data!.attention],
              ["projectsWorkCompleted", summary.data!.completed],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-border/60 bg-card p-4"
            >
              <div className="text-2xl font-semibold">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t(label)}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-xl border border-border/60 p-5 text-sm text-muted-foreground">
            {summary.isError ? t("projectsLoadFailed") : t("projectsLoading")}
          </div>
        )}
      </section>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ProjectSection title={t("projectsWorkRecentlyUpdated")}>
          {work.isLoading ? (
            <p className="py-5 text-sm text-muted-foreground">
              {t("projectsLoading")}
            </p>
          ) : work.isError ? (
            <p className="py-5 text-sm text-destructive">
              {t("projectsLoadFailed")}
            </p>
          ) : recent.length ? (
            <div className="space-y-2">
              {recent.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl bg-muted/45 px-3 py-3 text-left transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                  onClick={() => onOpenWorkItem(item.id)}
                >
                  <span className="min-w-0 truncate text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {getProjectWorkStateLabel(item.state.name)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <ProjectEmptyState>{t("projectsWorkEmpty")}</ProjectEmptyState>
          )}
        </ProjectSection>
        <ProjectSection title={t("projectsRecentArtifacts")}>
          {artifacts.isLoading ? (
            <p className="py-5 text-sm text-muted-foreground">
              {t("projectsLoading")}
            </p>
          ) : artifacts.isError ? (
            <p className="py-5 text-sm text-destructive">
              {t("projectsLoadFailed")}
            </p>
          ) : artifacts.data?.artifacts.length ? (
            <div className="space-y-2">
              {artifacts.data.artifacts.map((artifact) => (
                <ProjectFilePreviewButton
                  key={artifact.id}
                  available={artifact.exists}
                  path={artifact.path}
                  label={artifact.label ?? artifact.path}
                  onOpen={onOpenArtifact}
                  className="block w-full rounded-xl bg-muted/45 p-3 text-left text-sm transition-colors enabled:hover:bg-[var(--interaction-hover)] enabled:focus-visible:outline-none enabled:focus-visible:ring-1 enabled:focus-visible:ring-border"
                >
                  <span className="block truncate font-medium">
                    {artifact.label ?? artifact.path}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {artifact.workItemTitle}
                    <time
                      dateTime={artifact.createdAt}
                      title={formatDateTime(artifact.createdAt)}
                    >
                      {` · ${formatProjectRelativeTime(artifact.createdAt)}`}
                    </time>
                    {!artifact.exists ? ` · ${t("projectsUnavailable")}` : ""}
                  </span>
                </ProjectFilePreviewButton>
              ))}
            </div>
          ) : (
            <ProjectEmptyState>
              {t("projectsNoRecentArtifacts")}
            </ProjectEmptyState>
          )}
        </ProjectSection>
      </div>
    </div>
  );
}
