import type { ProjectObservationSnapshot } from "@nextclaw/client-sdk";
import { formatDateShort, t } from "@/shared/lib/i18n";

export type ProjectArtifactSort =
  | "updated-desc"
  | "updated-asc"
  | "created-desc"
  | "name";

export const DEFAULT_PROJECT_ARTIFACT_SORT: ProjectArtifactSort = "updated-desc";

function timestamp(value?: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function byName(
  left: ProjectObservationSnapshot["artifacts"][number],
  right: ProjectObservationSnapshot["artifacts"][number],
): number {
  return left.path.localeCompare(right.path);
}

export function sortProjectArtifacts(
  artifacts: ProjectObservationSnapshot["artifacts"],
  sort: ProjectArtifactSort = DEFAULT_PROJECT_ARTIFACT_SORT,
): ProjectObservationSnapshot["artifacts"] {
  return [...artifacts].sort((left, right) => {
    if (sort === "name") return byName(left, right);
    const leftTimestamp = timestamp(
      sort === "created-desc"
        ? left.fileCreatedAt ?? left.fileUpdatedAt
        : left.fileUpdatedAt ?? left.fileCreatedAt,
    );
    const rightTimestamp = timestamp(
      sort === "created-desc"
        ? right.fileCreatedAt ?? right.fileUpdatedAt
        : right.fileUpdatedAt ?? right.fileCreatedAt,
    );
    const order = sort === "updated-asc"
      ? leftTimestamp - rightTimestamp
      : rightTimestamp - leftTimestamp;
    return order || byName(left, right);
  });
}

export function formatProjectRelativeTime(value?: string, now: Date = new Date()): string {
  if (!value) return "-";
  const date = new Date(value);
  const differenceMs = now.getTime() - date.getTime();
  if (Number.isNaN(date.getTime())) return value;
  if (differenceMs < 60_000) return t("projectsTimeJustNow");
  const minutes = Math.floor(differenceMs / 60_000);
  if (minutes < 60) return t("projectsTimeMinutesAgo").replace("{count}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("projectsTimeHoursAgo").replace("{count}", String(hours));
  const days = Math.floor(hours / 24);
  if (days === 1) return t("projectsTimeYesterday");
  if (days < 7) return t("projectsTimeDaysAgo").replace("{count}", String(days));
  return formatDateShort(value);
}
