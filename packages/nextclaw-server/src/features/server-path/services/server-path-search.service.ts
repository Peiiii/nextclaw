import { readdir, realpath, stat } from "node:fs/promises";
import {
  basename,
  dirname,
  relative,
  resolve,
} from "node:path";
import type { Dirent } from "node:fs";
import type {
  ServerPathSearchEntryView,
  ServerPathSearchView,
} from "@nextclaw-server/shared/types/server-api.types.js";
import {
  resolveServerPath,
  ServerPathResolutionError,
} from "@nextclaw-server/features/server-path/utils/server-path-resolution.utils.js";
import {
  isServerPathInside,
  normalizeServerPathRelativePath,
  resolveServerPathSearchScore,
} from "@nextclaw-server/features/server-path/utils/server-path-search.utils.js";

const DEFAULT_RESULT_LIMIT = 50;
const MAX_RESULT_LIMIT = 100;
const MAX_SCANNED_ENTRIES = 20_000;
const MAX_SEARCH_DEPTH = 24;
const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".cache",
  ".next",
  ".nuxt",
  ".output",
  ".parcel-cache",
  ".turbo",
  ".vite",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "ui-dist",
  "vendor",
]);

type ServerPathSearchOptions = {
  basePath?: string | null;
  query?: string | null;
  limit?: number;
};

type SearchDirectory = {
  absolutePath: string;
  depth: number;
};

type ScoredEntry = {
  entry: ServerPathSearchEntryView;
  score: number;
};

export type ServerPathSearchErrorCode =
  | "SERVER_PATH_BASE_REQUIRED"
  | "SERVER_PATH_NOT_FOUND"
  | "SERVER_PATH_NOT_DIRECTORY"
  | "SERVER_PATH_NOT_READABLE";

export class ServerPathSearchError extends Error {
  constructor(
    readonly code: ServerPathSearchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServerPathSearchError";
  }
}

export class ServerPathSearchService {
  search = async (
    options: ServerPathSearchOptions,
  ): Promise<ServerPathSearchView> => {
    const basePath = await this.resolveBasePath(options.basePath);
    const query = options.query?.trim() ?? "";
    const limit = Math.min(
      Math.max(options.limit ?? DEFAULT_RESULT_LIMIT, 1),
      MAX_RESULT_LIMIT,
    );
    const { candidates, scanLimitReached } = await this.scanCandidates({
      basePath,
      query,
    });

    candidates.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.entry.kind !== right.entry.kind) {
        return left.entry.kind === "directory" ? -1 : 1;
      }
      return left.entry.relativePath.localeCompare(right.entry.relativePath, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    return {
      basePath,
      query,
      entries: candidates.slice(0, limit).map(({ entry }) => entry),
      truncated: scanLimitReached || candidates.length > limit,
    };
  };

  private scanCandidates = async (params: {
    basePath: string;
    query: string;
  }): Promise<{ candidates: ScoredEntry[]; scanLimitReached: boolean }> => {
    const { basePath, query } = params;
    const queue: SearchDirectory[] = [
      { absolutePath: basePath, depth: 0 },
    ];
    const candidates: ScoredEntry[] = [];
    let scannedEntries = 0;
    let scanLimitReached = false;

    while (queue.length > 0 && !scanLimitReached) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      const scan = await this.scanDirectory({
        basePath,
        directory: current,
        query,
        remainingEntries: MAX_SCANNED_ENTRIES - scannedEntries,
      });
      scannedEntries += scan.scannedEntries;
      candidates.push(...scan.candidates);
      queue.push(...scan.directories);
      scanLimitReached = scan.limitReached;
      if (!query) {
        break;
      }
    }
    return { candidates, scanLimitReached };
  };

  private scanDirectory = async (params: {
    basePath: string;
    directory: SearchDirectory;
    query: string;
    remainingEntries: number;
  }): Promise<{
    candidates: ScoredEntry[];
    directories: SearchDirectory[];
    limitReached: boolean;
    scannedEntries: number;
  }> => {
    const { basePath, directory, query, remainingEntries } = params;
    const entries = await this.readDirectory({
      path: directory.absolutePath,
      required: directory.depth === 0,
    });
    const candidates: ScoredEntry[] = [];
    const directories: SearchDirectory[] = [];
    let scannedEntries = 0;
    for (const dirent of entries) {
      if (scannedEntries >= remainingEntries) {
        return { candidates, directories, limitReached: true, scannedEntries };
      }
      scannedEntries += 1;
      const result = await this.resolveEntry({
        basePath,
        directory,
        dirent,
      });
      if (!result) {
        continue;
      }
      const score = resolveServerPathSearchScore(result.entry, query);
      if (score > 0) {
        candidates.push({ entry: result.entry, score });
      }
      if (
        query &&
        result.canTraverse &&
        directory.depth < MAX_SEARCH_DEPTH &&
        !IGNORED_DIRECTORY_NAMES.has(dirent.name)
      ) {
        directories.push({
          absolutePath: result.entry.path,
          depth: directory.depth + 1,
        });
      }
    }
    return { candidates, directories, limitReached: false, scannedEntries };
  };

  private resolveBasePath = async (value: string | null | undefined): Promise<string> => {
    let resolvedPath: string;
    try {
      resolvedPath = resolveServerPath({ path: value });
    } catch (error) {
      if (error instanceof ServerPathResolutionError) {
        throw new ServerPathSearchError("SERVER_PATH_BASE_REQUIRED", error.message);
      }
      throw error;
    }
    let stats;
    try {
      stats = await stat(resolvedPath);
    } catch {
      throw new ServerPathSearchError(
        "SERVER_PATH_NOT_FOUND",
        "server path does not exist",
      );
    }
    if (!stats.isDirectory()) {
      throw new ServerPathSearchError(
        "SERVER_PATH_NOT_DIRECTORY",
        "server path must point to a directory",
      );
    }
    return await realpath(resolvedPath);
  };

  private readDirectory = async (params: {
    path: string;
    required: boolean;
  }): Promise<Dirent[]> => {
    try {
      return (await readdir(params.path, { withFileTypes: true })).sort((left, right) =>
        left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    } catch {
      if (!params.required) {
        return [];
      }
      throw new ServerPathSearchError(
        "SERVER_PATH_NOT_READABLE",
        "server path is not readable",
      );
    }
  };

  private resolveEntry = async (params: {
    basePath: string;
    directory: SearchDirectory;
    dirent: Dirent;
  }): Promise<{ entry: ServerPathSearchEntryView; canTraverse: boolean } | null> => {
    const { basePath, directory, dirent } = params;
    const entryPath = resolve(directory.absolutePath, dirent.name);
    let kind: ServerPathSearchEntryView["kind"] | null = dirent.isDirectory()
      ? "directory"
      : dirent.isFile()
        ? "file"
        : null;
    let canTraverse = kind === "directory";

    if (dirent.isSymbolicLink()) {
      let targetPath: string;
      try {
        targetPath = await realpath(entryPath);
      } catch {
        return null;
      }
      if (!isServerPathInside(basePath, targetPath)) {
        return null;
      }
      const targetStats = await stat(targetPath).catch(() => null);
      kind = targetStats?.isDirectory()
        ? "directory"
        : targetStats?.isFile()
          ? "file"
          : null;
      canTraverse = false;
    }
    if (!kind) {
      return null;
    }

    const relativePath = normalizeServerPathRelativePath(
      relative(basePath, entryPath),
    );
    return {
      entry: {
        name: basename(entryPath),
        path: entryPath,
        relativePath,
        parentRelativePath: normalizeServerPathRelativePath(dirname(relativePath)) === "."
          ? ""
          : normalizeServerPathRelativePath(dirname(relativePath)),
        kind,
        hidden: dirent.name.startsWith("."),
      },
      canTraverse,
    };
  };
}

export function isServerPathSearchError(
  error: unknown,
): error is ServerPathSearchError {
  return error instanceof ServerPathSearchError;
}
