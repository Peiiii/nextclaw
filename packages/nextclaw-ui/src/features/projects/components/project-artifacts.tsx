import { useState } from "react";
import { useProjectArtifacts } from "@/features/projects/hooks/use-project-work";
import { formatProjectRelativeTime } from "@/features/projects/utils/project-artifact-view.utils";
import { formatDateTime, formatNumber, t } from "@/shared/lib/i18n";
import { ProjectEmptyState, ProjectFilePreviewButton } from "./project-section";

const PAGE_SIZE = 20;

export function ProjectArtifacts({
  projectId,
  onOpenFile,
}: {
  projectId: string;
  onOpenFile: (path: string, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const artifacts = useProjectArtifacts(projectId, {
    limit: PAGE_SIZE,
    ...(query.trim() ? { query: query.trim() } : {}),
  });
  const pages = artifacts.data?.pages ?? [];
  const items = pages.flatMap((page) => page.artifacts);
  const total = pages[0]?.total ?? 0;

  if (artifacts.isLoading) {
    return (
      <p className="py-5 text-sm text-muted-foreground">
        {t("projectsLoading")}
      </p>
    );
  }
  if (artifacts.isError) {
    return (
      <p className="py-5 text-sm text-destructive">{t("projectsLoadFailed")}</p>
    );
  }

  return (
    <section className="min-w-0" aria-label={t("projectsArtifacts")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {formatNumber(total)} {t("projectsArtifactsCountSuffix")}
        </p>
        <input
          type="search"
          value={query}
          className="h-8 w-full min-w-0 rounded-lg border border-border/60 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground sm:w-60"
          placeholder={t("projectsArtifactsSearchPlaceholder")}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {items.length ? (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <div className="divide-y divide-border/60">
            {items.map((artifact) => (
              <ProjectFilePreviewButton
                key={artifact.id}
                available={artifact.exists}
                path={artifact.path}
                label={artifact.label ?? artifact.path}
                onOpen={onOpenFile}
                className="flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left text-sm transition-colors enabled:hover:bg-[var(--interaction-hover)] enabled:focus-visible:outline-none enabled:focus-visible:ring-1 enabled:focus-visible:ring-border"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {artifact.label ?? artifact.path}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {artifact.path} · {artifact.workItemTitle}
                  </span>
                </span>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={artifact.createdAt}
                  title={formatDateTime(artifact.createdAt)}
                >
                  {formatProjectRelativeTime(artifact.createdAt)}
                </time>
                {!artifact.exists ? (
                  <span className="shrink-0 text-xs text-destructive">
                    {t("projectsUnavailable")}
                  </span>
                ) : null}
              </ProjectFilePreviewButton>
            ))}
          </div>
          {artifacts.hasNextPage ? (
            <button
              type="button"
              className="w-full border-t border-border/60 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
              disabled={artifacts.isFetchingNextPage}
              onClick={() => void artifacts.fetchNextPage()}
            >
              {artifacts.isFetchingNextPage
                ? t("projectsLoading")
                : t("projectsArtifactsShowMore")}
            </button>
          ) : null}
        </div>
      ) : (
        <ProjectEmptyState>
          {query.trim()
            ? t("projectsArtifactsNoMatches")
            : t("projectsNoArtifacts")}
        </ProjectEmptyState>
      )}
    </section>
  );
}
