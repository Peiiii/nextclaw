import { isAbsolute, relative, sep } from "node:path";
import type { ServerPathSearchEntryView } from "@nextclaw-server/shared/types/server-api.types.js";

export function isServerPathInside(basePath: string, candidatePath: string): boolean {
  const relativePath = relative(basePath, candidatePath);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}

export function normalizeServerPathRelativePath(value: string): string {
  return value.split(sep).join("/");
}

export function resolveServerPathSearchScore(
  entry: ServerPathSearchEntryView,
  query: string,
): number {
  if (!query) {
    return 1;
  }
  const normalizedQuery = query.toLocaleLowerCase();
  const normalizedName = entry.name.toLocaleLowerCase();
  const normalizedPath = entry.relativePath.toLocaleLowerCase();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!terms.every((term) => normalizedPath.includes(term))) {
    return 0;
  }
  if (normalizedName === normalizedQuery) {
    return 1_000;
  }
  if (normalizedName.startsWith(normalizedQuery)) {
    return 850;
  }
  if (normalizedName.includes(normalizedQuery)) {
    return 700;
  }
  if (normalizedPath.startsWith(normalizedQuery)) {
    return 600;
  }
  if (normalizedPath.split("/").some((segment) => segment.startsWith(normalizedQuery))) {
    return 550;
  }
  return 400 - Math.min(normalizedPath.length, 300);
}
