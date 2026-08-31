import { useMemo, useState } from "react";
import type { ProjectObservationSnapshot } from "@nextclaw/client-sdk";
import { formatDateTime, formatNumber, t } from "@/shared/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { ProjectEmptyState, ProjectFilePreviewButton } from "./project-section";
import {
  DEFAULT_PROJECT_ARTIFACT_SORT,
  formatProjectRelativeTime,
  sortProjectArtifacts,
  type ProjectArtifactSort,
} from "../utils/project-artifact-view.utils";

const INITIAL_VISIBLE_COUNT = 10;

type ArtifactGroup = {
  id: string;
  label: string;
  artifacts: ProjectObservationSnapshot["artifacts"];
};

function createArtifactGroups(
  snapshot: ProjectObservationSnapshot,
  query: string,
  sort: ProjectArtifactSort,
): ArtifactGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredArtifacts = normalizedQuery
    ? snapshot.artifacts.filter((artifact) => artifact.path.toLocaleLowerCase().includes(normalizedQuery))
    : snapshot.artifacts;
  const artifacts = sortProjectArtifacts(filteredArtifacts, sort);
  const artifactsByCategory = new Map<string, ProjectObservationSnapshot["artifacts"]>();
  for (const artifact of artifacts) {
    const group = artifactsByCategory.get(artifact.categoryId) ?? [];
    group.push(artifact);
    artifactsByCategory.set(artifact.categoryId, group);
  }
  const configuredCategories = snapshot.artifactCategories ?? [];
  const configuredIds = new Set(configuredCategories.map((category) => category.id));
  const groups = configuredCategories.flatMap((category) => {
    const groupArtifacts = artifactsByCategory.get(category.id) ?? [];
    return groupArtifacts.length ? [{ ...category, artifacts: groupArtifacts }] : [];
  });
  const unconfiguredGroups = [...artifactsByCategory.entries()]
    .filter(([categoryId]) => !configuredIds.has(categoryId))
    .map(([id, groupArtifacts]) => ({
      id,
      label: groupArtifacts[0]?.categoryLabel ?? id,
      artifacts: groupArtifacts,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
  return [...groups, ...unconfiguredGroups];
}

export function ProjectArtifacts({
  snapshot,
  onOpenFile,
}: {
  snapshot: ProjectObservationSnapshot;
  onOpenFile: (path: string, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProjectArtifactSort>(DEFAULT_PROJECT_ARTIFACT_SORT);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const groups = useMemo(() => createArtifactGroups(snapshot, query, sort), [query, snapshot, sort]);
  const canSortByCreated = snapshot.artifacts.some((artifact) => artifact.fileCreatedAt);

  if (!snapshot.artifacts.length) {
    return <ProjectEmptyState>{t("projectsNoArtifacts")}</ProjectEmptyState>;
  }

  return (
    <section className="min-w-0" aria-label={t("projectsArtifacts")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {formatNumber(snapshot.artifacts.length)} {t("projectsArtifactsCountSuffix")}
        </p>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select value={sort} onValueChange={(value) => setSort(value as ProjectArtifactSort)}>
            <SelectTrigger aria-label={t("projectsArtifactsSort")} className="h-8 w-32 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated-desc">{t("projectsArtifactsSortUpdatedDesc")}</SelectItem>
              <SelectItem value="updated-asc">{t("projectsArtifactsSortUpdatedAsc")}</SelectItem>
              {canSortByCreated ? (
                <SelectItem value="created-desc">{t("projectsArtifactsSortCreatedDesc")}</SelectItem>
              ) : null}
              <SelectItem value="name">{t("projectsArtifactsSortName")}</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="search"
            value={query}
            className="h-8 min-w-0 flex-1 rounded-lg border border-border/60 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-border sm:w-60"
            placeholder={t("projectsArtifactsSearchPlaceholder")}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCounts({});
            }}
          />
        </div>
      </div>
      {groups.length ? (
        <div className="space-y-2">
          {groups.map((group) => {
            const collapsed = collapsedGroups.has(group.id);
            const visibleCount = visibleCounts[group.id] ?? INITIAL_VISIBLE_COUNT;
            const visibleArtifacts = group.artifacts.slice(0, visibleCount);
            return (
              <section key={group.id} className="overflow-hidden rounded-xl border border-border/60">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 bg-muted/30 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                  aria-label={`${group.label} ${formatNumber(group.artifacts.length)}`}
                  aria-expanded={!collapsed}
                  onClick={() => setCollapsedGroups((current) => {
                    const next = new Set(current);
                    if (next.has(group.id)) next.delete(group.id);
                    else next.add(group.id);
                    return next;
                  })}
                >
                  <span className="min-w-0 truncate font-medium">{group.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatNumber(group.artifacts.length)} {collapsed ? "▸" : "▾"}
                  </span>
                </button>
                {!collapsed ? (
                  <div className="divide-y divide-border/60">
                    {visibleArtifacts.map((artifact) => (
                      <ProjectFilePreviewButton
                        key={artifact.id}
                        available={artifact.exists}
                        path={artifact.path}
                        label={artifact.path}
                        onOpen={onOpenFile}
                        className="flex w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors enabled:hover:bg-[var(--interaction-hover)] enabled:focus-visible:outline-none enabled:focus-visible:ring-1 enabled:focus-visible:ring-border"
                      >
                        <span className="min-w-0 flex-1 truncate">{artifact.path}</span>
                        {artifact.fileUpdatedAt ? (
                          <time
                            className="shrink-0 text-xs text-muted-foreground"
                            dateTime={artifact.fileUpdatedAt}
                            title={formatDateTime(artifact.fileUpdatedAt)}
                          >
                            {formatProjectRelativeTime(artifact.fileUpdatedAt)}
                          </time>
                        ) : null}
                        {!artifact.exists ? (
                          <span className="shrink-0 text-xs text-destructive">
                            {t("projectsUnavailable")}
                          </span>
                        ) : null}
                      </ProjectFilePreviewButton>
                    ))}
                    {group.artifacts.length > visibleArtifacts.length ? (
                      <button
                        type="button"
                        className="w-full px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                        onClick={() => setVisibleCounts((current) => ({
                          ...current,
                          [group.id]: visibleCount + INITIAL_VISIBLE_COUNT,
                        }))}
                      >
                        {t("projectsArtifactsShowMore")} ({formatNumber(
                          Math.min(INITIAL_VISIBLE_COUNT, group.artifacts.length - visibleArtifacts.length),
                        )})
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <ProjectEmptyState>{t("projectsArtifactsNoMatches")}</ProjectEmptyState>
      )}
    </section>
  );
}
