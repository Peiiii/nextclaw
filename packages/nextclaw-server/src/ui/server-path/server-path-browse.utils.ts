import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, parse, resolve } from "node:path";
import { expandHome } from "@nextclaw/core";
import type {
  ServerPathBreadcrumbView,
  ServerPathBrowseView,
  ServerPathEntryView,
} from "../types.js";

type BrowseServerPathOptions = {
  path?: string | null;
  includeFiles?: boolean;
};

type ServerPathBrowseErrorCode =
  | "SERVER_PATH_NOT_FOUND"
  | "SERVER_PATH_NOT_DIRECTORY"
  | "SERVER_PATH_NOT_READABLE";

export class ServerPathBrowseError extends Error {
  constructor(
    readonly code: ServerPathBrowseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServerPathBrowseError";
  }
}

function normalizeBrowsePath(path?: string | null): string {
  const trimmed = typeof path === "string" ? path.trim() : "";
  return resolve(expandHome(trimmed || homedir()));
}

function readRootLabel(rootPath: string): string {
  const normalized = rootPath.replace(/[\\/]+$/, "");
  return normalized || rootPath;
}

function buildBreadcrumbs(currentPath: string): ServerPathBreadcrumbView[] {
  const parsedPath = parse(currentPath);
  const rootPath = parsedPath.root || currentPath;
  const rootBreadcrumb: ServerPathBreadcrumbView = {
    label: readRootLabel(rootPath),
    path: rootPath,
  };
  const relativeSegments = currentPath
    .slice(rootPath.length)
    .split(/[\\/]+/)
    .filter(Boolean);

  const breadcrumbs = [rootBreadcrumb];
  let breadcrumbPath = rootPath;
  for (const segment of relativeSegments) {
    breadcrumbPath = resolve(breadcrumbPath, segment);
    breadcrumbs.push({
      label: segment,
      path: breadcrumbPath,
    });
  }
  return breadcrumbs;
}

async function resolveEntryView(params: {
  parentPath: string;
  entryName: string;
  includeFiles: boolean;
}): Promise<ServerPathEntryView | null> {
  const entryPath = resolve(params.parentPath, params.entryName);
  let entryStats;
  try {
    entryStats = await stat(entryPath);
  } catch {
    return null;
  }

  const isDirectory = entryStats.isDirectory();
  if (!isDirectory && !params.includeFiles) {
    return null;
  }

  return {
    name: params.entryName,
    path: entryPath,
    kind: isDirectory ? "directory" : "file",
    hidden: params.entryName.startsWith("."),
  };
}

function sortEntryViews(left: ServerPathEntryView, right: ServerPathEntryView): number {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }
  return left.name.localeCompare(right.name);
}

export async function browseServerPath(
  options: BrowseServerPathOptions = {},
): Promise<ServerPathBrowseView> {
  const currentPath = normalizeBrowsePath(options.path);

  let currentPathStats;
  try {
    currentPathStats = await stat(currentPath);
  } catch {
    throw new ServerPathBrowseError(
      "SERVER_PATH_NOT_FOUND",
      "server path does not exist",
    );
  }
  if (!currentPathStats.isDirectory()) {
    throw new ServerPathBrowseError(
      "SERVER_PATH_NOT_DIRECTORY",
      "server path must point to a directory",
    );
  }

  let entryNames: string[];
  try {
    entryNames = await readdir(currentPath);
  } catch {
    throw new ServerPathBrowseError(
      "SERVER_PATH_NOT_READABLE",
      "server path is not readable",
    );
  }

  const entries = (
    await Promise.all(
      entryNames.map((entryName) =>
        resolveEntryView({
          parentPath: currentPath,
          entryName,
          includeFiles: options.includeFiles ?? false,
        }),
      ),
    )
  )
    .filter((entry): entry is ServerPathEntryView => entry !== null)
    .sort(sortEntryViews);

  const parentPath = dirname(currentPath);

  return {
    currentPath,
    parentPath: parentPath === currentPath ? null : parentPath,
    homePath: resolve(homedir()),
    breadcrumbs: buildBreadcrumbs(currentPath),
    entries,
  };
}

export function isServerPathBrowseError(
  error: unknown,
): error is ServerPathBrowseError {
  return error instanceof ServerPathBrowseError;
}
