import { formatDateShort, t } from "@/shared/lib/i18n";

export function joinProjectPath(
  rootPath: string,
  relativePath: string,
): string {
  const separator =
    rootPath.endsWith("/") || rootPath.endsWith("\\") ? "" : "/";
  return `${rootPath}${separator}${relativePath}`;
}

export function formatProjectRelativeTime(
  value?: string,
  now: Date = new Date(),
): string {
  if (!value) return "-";
  const date = new Date(value);
  const differenceMs = now.getTime() - date.getTime();
  if (Number.isNaN(date.getTime())) return value;
  if (differenceMs < 60_000) return t("projectsTimeJustNow");
  const minutes = Math.floor(differenceMs / 60_000);
  if (minutes < 60)
    return t("projectsTimeMinutesAgo").replace("{count}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return t("projectsTimeHoursAgo").replace("{count}", String(hours));
  const days = Math.floor(hours / 24);
  if (days === 1) return t("projectsTimeYesterday");
  if (days < 7)
    return t("projectsTimeDaysAgo").replace("{count}", String(days));
  return formatDateShort(value);
}
