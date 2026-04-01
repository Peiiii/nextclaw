function trimOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeSessionProjectRootValue(value: unknown): string | null {
  return trimOptionalString(value);
}

export function getSessionProjectName(
  projectRoot: string | null | undefined,
): string | null {
  const normalizedProjectRoot = trimOptionalString(projectRoot);
  if (!normalizedProjectRoot) {
    return null;
  }

  const trimmedTrailingSeparators = normalizedProjectRoot.replace(/[\\/]+$/, "");
  if (!trimmedTrailingSeparators) {
    return normalizedProjectRoot;
  }

  const pathSegments = trimmedTrailingSeparators
    .split(/[\\/]/)
    .filter(Boolean);
  return pathSegments[pathSegments.length - 1] ?? trimmedTrailingSeparators;
}
