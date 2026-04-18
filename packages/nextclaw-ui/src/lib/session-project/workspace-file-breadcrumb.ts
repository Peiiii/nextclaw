import { getSessionProjectName } from "@/lib/session-project/session-project.utils";

export type WorkspaceFileBreadcrumbSegmentViewModel = {
  key: string;
  label: string;
  kind: "workspace" | "root" | "directory" | "file";
  isCurrent: boolean;
};

export type WorkspaceFileBreadcrumbViewModel = {
  fullPath: string;
  locationLabel: string | null;
  truncated: boolean;
  segments: WorkspaceFileBreadcrumbSegmentViewModel[];
};

function trimPathSeparators(value: string): string {
  if (/^[A-Za-z]:[\\/]?$/.test(value) || value === "/") {
    return value;
  }
  return value.replace(/[\\/]+$/, "");
}

function normalizeComparablePath(value: string): string {
  const trimmed = trimPathSeparators(value.trim().replace(/\\/g, "/"));
  return /^[A-Za-z]:/.test(trimmed)
    ? `${trimmed.slice(0, 1).toLowerCase()}${trimmed.slice(1)}`
    : trimmed;
}

function readDisplaySegments(value: string): {
  prefix: string | null;
  segments: string[];
} {
  const normalized = value.trim().replace(/\\/g, "/");

  if (!normalized) {
    return { prefix: null, segments: [] };
  }

  if (/^[A-Za-z]:\//.test(normalized)) {
    return {
      prefix: normalized.slice(0, 2),
      segments: normalized.slice(3).split("/").filter(Boolean),
    };
  }

  if (normalized.startsWith("/")) {
    return {
      prefix: "/",
      segments: normalized.slice(1).split("/").filter(Boolean),
    };
  }

  return {
    prefix: null,
    segments: normalized.split("/").filter(Boolean),
  };
}

function readRelativeSegments(params: {
  path: string;
  sessionProjectRoot: string;
}): string[] | null {
  const normalizedPath = normalizeComparablePath(params.path);
  const normalizedRoot = normalizeComparablePath(params.sessionProjectRoot);

  if (!normalizedPath || !normalizedRoot) {
    return null;
  }

  if (
    !normalizedPath.startsWith("/") &&
    !/^[A-Za-z]:\//.test(normalizedPath)
  ) {
    return normalizedPath.split("/").filter(Boolean);
  }

  if (normalizedPath === normalizedRoot) {
    return [];
  }

  const rootPrefix = normalizedRoot.endsWith("/")
    ? normalizedRoot
    : `${normalizedRoot}/`;

  if (!normalizedPath.startsWith(rootPrefix)) {
    return null;
  }

  return normalizedPath.slice(rootPrefix.length).split("/").filter(Boolean);
}

function buildSegmentsFromLabels(params: {
  labels: string[];
  leading?: WorkspaceFileBreadcrumbSegmentViewModel | null;
}): WorkspaceFileBreadcrumbSegmentViewModel[] {
  const { labels, leading = null } = params;
  const items = labels.map<WorkspaceFileBreadcrumbSegmentViewModel>(
    (label, index) => ({
      key: `${index}:${label}`,
      label,
      kind: index === labels.length - 1 ? "file" : "directory",
      isCurrent: index === labels.length - 1,
    }),
  );

  return leading ? [leading, ...items] : items;
}

function buildLocationLabel(params: {
  line?: number | null;
  column?: number | null;
}): string | null {
  const { column, line } = params;

  if (typeof line !== "number") {
    return null;
  }

  return `L${line}${typeof column === "number" ? `:${column}` : ""}`;
}

export function buildWorkspaceFileBreadcrumb(params: {
  path: string;
  sessionProjectRoot: string | null;
  line?: number | null;
  column?: number | null;
  truncated: boolean;
}): WorkspaceFileBreadcrumbViewModel {
  const { column, line, path, sessionProjectRoot, truncated } = params;
  const fullPath = path.trim();
  const relativeSegments =
    sessionProjectRoot?.trim() && fullPath
      ? readRelativeSegments({
          path: fullPath,
          sessionProjectRoot,
        })
      : null;

  let segments: WorkspaceFileBreadcrumbSegmentViewModel[];

  if (sessionProjectRoot?.trim() && relativeSegments) {
    const workspaceLabel =
      getSessionProjectName(sessionProjectRoot) ?? sessionProjectRoot.trim();

    segments = buildSegmentsFromLabels({
      labels: relativeSegments,
      leading: {
        key: `workspace:${workspaceLabel}`,
        label: workspaceLabel,
        kind: "workspace",
        isCurrent: relativeSegments.length === 0,
      },
    });
  } else {
    const { prefix, segments: labels } = readDisplaySegments(fullPath);
    segments = buildSegmentsFromLabels({
      labels,
      leading: prefix
        ? {
            key: `root:${prefix}`,
            label: prefix,
            kind: "root",
            isCurrent: labels.length === 0,
          }
        : null,
    });
  }

  if (segments.length === 0) {
    segments = [
      {
        key: "file:unknown",
        label: fullPath || "file",
        kind: "file",
        isCurrent: true,
      },
    ];
  }

  return {
    fullPath,
    locationLabel: buildLocationLabel({ line, column }),
    truncated,
    segments,
  };
}
