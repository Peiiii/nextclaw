import { t } from "@/shared/lib/i18n";
import {
  useProjectWork,
  useProjectWorkSummary,
} from "@/features/projects/hooks/use-project-work";

export function ProjectOverview({
  projectId,
  onOpenWorkItem,
}: {
  projectId: string;
  onOpenWorkItem: (workItemId: string) => void;
}) {
  const summary = useProjectWorkSummary(projectId);
  const work = useProjectWork(projectId);
  if (summary.isLoading || work.isLoading)
    return (
      <div className="rounded-xl border border-border/60 p-5 text-sm text-muted-foreground">
        {t("projectsLoading")}
      </div>
    );
  if (summary.isError || work.isError)
    return (
      <div className="rounded-xl border border-destructive/40 p-5 text-sm text-destructive">
        {t("projectsLoadFailed")}
      </div>
    );
  const recent = work.data!.items.slice(0, 5);
  return (
    <div className="space-y-5">
      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label={t("projectsWorkSummary")}
      >
        {(
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
            <div className="mt-1 text-xs text-muted-foreground">{t(label)}</div>
          </div>
        ))}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold">
          {t("projectsWorkRecentlyUpdated")}
        </h2>
        <div className="space-y-2">
          {recent.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-left hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
              onClick={() => onOpenWorkItem(item.id)}
            >
              <span className="min-w-0 truncate text-sm font-medium">
                {item.title}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.state.name}
              </span>
            </button>
          ))}
          {!recent.length ? (
            <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              {t("projectsWorkEmpty")}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
