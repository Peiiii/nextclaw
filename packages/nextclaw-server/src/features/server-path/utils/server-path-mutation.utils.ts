import { lstat, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { isServerPathInside } from "@nextclaw-server/features/server-path/utils/server-path-search.utils.js";
import {
  resolveServerPath,
  ServerPathResolutionError,
} from "@nextclaw-server/features/server-path/utils/server-path-resolution.utils.js";

export type ServerPathMutationErrorCode =
  | "SERVER_PATH_BASE_INVALID"
  | "SERVER_PATH_ENTRY_INVALID"
  | "SERVER_PATH_ENTRY_NOT_FOUND"
  | "SERVER_PATH_FILE_EXISTS"
  | "SERVER_PATH_FILE_NAME_INVALID"
  | "SERVER_PATH_OUTSIDE_BASE"
  | "SERVER_PATH_ROOT_PROTECTED"
  | "SERVER_PATH_TARGET_NOT_DIRECTORY"
  | "SERVER_PATH_TARGET_NOT_WRITABLE";

export class ServerPathMutationError extends Error {
  constructor(
    readonly code: ServerPathMutationErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServerPathMutationError";
  }
}

export type ServerPathUploadFile = {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function readFileErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : undefined;
}

function resolveScopedPaths(input: { basePath: unknown; targetPath: unknown; allowRoot?: boolean }): {
  basePath: string;
  targetPath: string;
} {
  let basePath: string;
  let targetPath: string;
  try {
    basePath = resolveServerPath({
      path: typeof input.basePath === "string" ? input.basePath : null,
    });
    targetPath = resolveServerPath({
      path: typeof input.targetPath === "string" ? input.targetPath : null,
      basePath,
    });
  } catch (error) {
    if (error instanceof ServerPathResolutionError) {
      throw new ServerPathMutationError("SERVER_PATH_BASE_INVALID", error.message);
    }
    throw error;
  }
  if (!isServerPathInside(basePath, targetPath)) {
    throw new ServerPathMutationError("SERVER_PATH_OUTSIDE_BASE", "target path must stay inside the project root");
  }
  if (!input.allowRoot && targetPath === basePath) {
    throw new ServerPathMutationError("SERVER_PATH_ROOT_PROTECTED", "the project root cannot be deleted");
  }
  return { basePath, targetPath };
}

async function resolveRealBasePath(basePath: string): Promise<string> {
  try {
    const resolved = await realpath(basePath);
    const stats = await stat(resolved);
    if (!stats.isDirectory()) {
      throw new ServerPathMutationError("SERVER_PATH_BASE_INVALID", "project root must point to a directory");
    }
    return resolved;
  } catch (error) {
    if (error instanceof ServerPathMutationError) {
      throw error;
    }
    throw new ServerPathMutationError("SERVER_PATH_BASE_INVALID", "project root does not exist or is not accessible");
  }
}

async function assertExistingPathInsideRealBase(params: { basePath: string; targetPath: string }): Promise<void> {
  const [realBasePath, realTargetPath] = await Promise.all([
    resolveRealBasePath(params.basePath),
    realpath(params.targetPath).catch(() => null),
  ]);
  if (!realTargetPath) {
    throw new ServerPathMutationError("SERVER_PATH_ENTRY_NOT_FOUND", "target path does not exist");
  }
  if (!isServerPathInside(realBasePath, realTargetPath)) {
    throw new ServerPathMutationError("SERVER_PATH_OUTSIDE_BASE", "target path must stay inside the project root");
  }
}

function normalizeEntryName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    basename(name) !== name
  ) {
    throw new ServerPathMutationError("SERVER_PATH_FILE_NAME_INVALID", "entry name is invalid");
  }
  return name;
}

export async function createServerPathFile(input: {
  basePath: unknown;
  parentPath: unknown;
  name: unknown;
}): Promise<{ name: string; path: string; kind: "file" }> {
  const { basePath, targetPath: parentPath } = resolveScopedPaths({
    basePath: input.basePath,
    targetPath: input.parentPath,
    allowRoot: true,
  });
  await assertExistingPathInsideRealBase({ basePath, targetPath: parentPath });
  const parentStats = await stat(parentPath).catch(() => null);
  if (!parentStats?.isDirectory()) {
    throw new ServerPathMutationError("SERVER_PATH_TARGET_NOT_DIRECTORY", "file parent must point to a directory");
  }
  const name = normalizeEntryName(input.name);
  const path = join(parentPath, name);
  try {
    await writeFile(path, "", { flag: "wx" });
  } catch (error) {
    const code = readFileErrorCode(error);
    if (code === "EEXIST") throw new ServerPathMutationError("SERVER_PATH_FILE_EXISTS", "target file already exists");
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new ServerPathMutationError("SERVER_PATH_TARGET_NOT_WRITABLE", "file parent is not writable");
    }
    throw error;
  }
  return { name, path, kind: "file" };
}

export async function renameServerPathEntry(input: { basePath: unknown; path: unknown; name: unknown }): Promise<{
  oldPath: string;
  path: string;
  name: string;
  kind: "directory" | "file";
}> {
  const { basePath, targetPath } = resolveScopedPaths({
    basePath: input.basePath,
    targetPath: input.path,
  });
  await assertExistingPathInsideRealBase({ basePath, targetPath });
  const entryStats = await lstat(targetPath).catch(() => null);
  if (!entryStats) throw new ServerPathMutationError("SERVER_PATH_ENTRY_NOT_FOUND", "target path does not exist");
  const name = normalizeEntryName(input.name);
  const path = join(resolve(targetPath, ".."), name);
  if (!isServerPathInside(basePath, path))
    throw new ServerPathMutationError("SERVER_PATH_OUTSIDE_BASE", "target path must stay inside the project root");
  if (
    await lstat(path)
      .then(() => true)
      .catch(() => false)
  ) {
    throw new ServerPathMutationError("SERVER_PATH_FILE_EXISTS", "target entry already exists");
  }
  try {
    await rename(targetPath, path);
  } catch (error) {
    const code = readFileErrorCode(error);
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new ServerPathMutationError("SERVER_PATH_TARGET_NOT_WRITABLE", "target path is not writable");
    }
    throw error;
  }
  return {
    oldPath: targetPath,
    path,
    name,
    kind: entryStats.isDirectory() ? "directory" : "file",
  };
}

export async function deleteServerPathEntry(input: {
  basePath: unknown;
  path: unknown;
}): Promise<{ path: string; kind: "directory" | "file" }> {
  const { basePath, targetPath } = resolveScopedPaths({
    basePath: input.basePath,
    targetPath: input.path,
  });
  await assertExistingPathInsideRealBase({ basePath, targetPath });

  let entryStats;
  try {
    entryStats = await lstat(targetPath);
  } catch {
    throw new ServerPathMutationError("SERVER_PATH_ENTRY_NOT_FOUND", "target path does not exist");
  }
  const kind = entryStats.isDirectory() ? "directory" : "file";
  try {
    await rm(targetPath, { recursive: kind === "directory", force: false });
  } catch (error) {
    const code = readFileErrorCode(error);
    if (code === "ENOENT") {
      throw new ServerPathMutationError("SERVER_PATH_ENTRY_NOT_FOUND", "target path does not exist");
    }
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new ServerPathMutationError("SERVER_PATH_TARGET_NOT_WRITABLE", "target path is not writable");
    }
    throw error;
  }
  return { path: targetPath, kind };
}

export async function uploadServerPathFiles(input: {
  basePath: unknown;
  targetPath: unknown;
  overwrite: boolean;
  files: readonly ServerPathUploadFile[];
}): Promise<{
  files: Array<{ name: string; path: string; sizeBytes: number }>;
  overwritten: boolean;
}> {
  const { basePath, targetPath } = resolveScopedPaths({
    basePath: input.basePath,
    targetPath: input.targetPath,
    allowRoot: true,
  });
  await assertExistingPathInsideRealBase({ basePath, targetPath });
  const targetStats = await stat(targetPath).catch(() => null);
  if (!targetStats?.isDirectory()) {
    throw new ServerPathMutationError("SERVER_PATH_TARGET_NOT_DIRECTORY", "upload target must point to a directory");
  }
  if (input.files.length === 0) {
    throw new ServerPathMutationError("SERVER_PATH_ENTRY_INVALID", "at least one upload file is required");
  }

  const normalizedFiles = input.files.map((file) => ({
    file,
    name: normalizeEntryName(file.name),
  }));
  const uniqueNames = new Set<string>();
  for (const { name } of normalizedFiles) {
    if (uniqueNames.has(name)) {
      throw new ServerPathMutationError("SERVER_PATH_FILE_NAME_INVALID", "upload file names must be unique");
    }
    uniqueNames.add(name);
  }

  if (!input.overwrite) {
    const conflicts = (
      await Promise.all(
        normalizedFiles.map(async ({ name }) => {
          const exists = await lstat(join(targetPath, name))
            .then(() => true)
            .catch(() => false);
          return exists ? name : null;
        }),
      )
    ).filter((name): name is string => Boolean(name));
    if (conflicts.length > 0) {
      throw new ServerPathMutationError("SERVER_PATH_FILE_EXISTS", "one or more upload files already exist", {
        conflicts,
      });
    }
  }

  try {
    const files = await Promise.all(
      normalizedFiles.map(async ({ file, name }) => {
        const path = resolve(targetPath, name);
        const content = Buffer.from(await file.arrayBuffer());
        await writeFile(path, content, { flag: input.overwrite ? "w" : "wx" });
        return { name, path, sizeBytes: content.byteLength };
      }),
    );
    return { files, overwritten: input.overwrite };
  } catch (error) {
    const code = readFileErrorCode(error);
    if (code === "EEXIST") {
      throw new ServerPathMutationError("SERVER_PATH_FILE_EXISTS", "one or more upload files already exist");
    }
    if (code === "ENOENT" || code === "ENOTDIR") {
      throw new ServerPathMutationError(
        "SERVER_PATH_TARGET_NOT_DIRECTORY",
        "upload target must point to an existing directory",
      );
    }
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new ServerPathMutationError("SERVER_PATH_TARGET_NOT_WRITABLE", "upload target is not writable");
    }
    throw error;
  }
}

export function isServerPathMutationError(error: unknown): error is ServerPathMutationError {
  return error instanceof ServerPathMutationError;
}
