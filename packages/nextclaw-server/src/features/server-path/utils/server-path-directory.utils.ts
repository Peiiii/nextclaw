import { mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import {
  resolveServerPath,
  ServerPathResolutionError,
} from "@nextclaw-server/features/server-path/utils/server-path-resolution.utils.js";
import { isServerPathInside } from "@nextclaw-server/features/server-path/utils/server-path-search.utils.js";

export type ServerPathDirectoryCreateErrorCode =
  | "SERVER_PATH_DIRECTORY_NAME_INVALID"
  | "SERVER_PATH_DIRECTORY_EXISTS"
  | "SERVER_PATH_PARENT_INVALID"
  | "SERVER_PATH_PARENT_NOT_FOUND"
  | "SERVER_PATH_PARENT_NOT_DIRECTORY"
  | "SERVER_PATH_PARENT_NOT_WRITABLE";

export class ServerPathDirectoryCreateError extends Error {
  constructor(
    readonly code: ServerPathDirectoryCreateErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServerPathDirectoryCreateError";
  }
}

function normalizeDirectoryName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
    throw new ServerPathDirectoryCreateError("SERVER_PATH_DIRECTORY_NAME_INVALID", "directory name is invalid");
  }
  return name;
}

function readFileErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : undefined;
}

function resolveDirectoryPath(value: unknown): string {
  try {
    return resolveServerPath({
      path: typeof value === "string" ? value : null,
    });
  } catch (error) {
    if (error instanceof ServerPathResolutionError) {
      throw new ServerPathDirectoryCreateError("SERVER_PATH_PARENT_INVALID", error.message);
    }
    throw error;
  }
}

async function assertParentInsideBase(baseValue: unknown, parentPath: string): Promise<void> {
  if (typeof baseValue !== "string" || !baseValue.trim()) {
    return;
  }
  const basePath = resolveDirectoryPath(baseValue);
  if (!isServerPathInside(basePath, parentPath)) {
    throw new ServerPathDirectoryCreateError(
      "SERVER_PATH_PARENT_INVALID",
      "parent path must stay inside the project root",
    );
  }
  try {
    const [realBasePath, realParentPath] = await Promise.all([realpath(basePath), realpath(parentPath)]);
    if (!isServerPathInside(realBasePath, realParentPath)) {
      throw new ServerPathDirectoryCreateError(
        "SERVER_PATH_PARENT_INVALID",
        "parent path must stay inside the project root",
      );
    }
  } catch (error) {
    if (error instanceof ServerPathDirectoryCreateError) {
      throw error;
    }
    throw new ServerPathDirectoryCreateError("SERVER_PATH_PARENT_INVALID", "project root and parent path must exist");
  }
}

function throwDirectoryCreationError(error: unknown): never {
  const code = readFileErrorCode(error);
  if (code === "EEXIST") {
    throw new ServerPathDirectoryCreateError("SERVER_PATH_DIRECTORY_EXISTS", "directory already exists");
  }
  if (code === "ENOENT") {
    throw new ServerPathDirectoryCreateError("SERVER_PATH_PARENT_NOT_FOUND", "parent directory does not exist");
  }
  if (code === "ENOTDIR") {
    throw new ServerPathDirectoryCreateError(
      "SERVER_PATH_PARENT_NOT_DIRECTORY",
      "parent path must point to a directory",
    );
  }
  if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
    throw new ServerPathDirectoryCreateError("SERVER_PATH_PARENT_NOT_WRITABLE", "parent directory is not writable");
  }
  throw error;
}

export async function createServerPathDirectory(input: {
  basePath?: unknown;
  parentPath: unknown;
  name: unknown;
}): Promise<{ path: string }> {
  const parentPath = resolveDirectoryPath(input.parentPath);
  await assertParentInsideBase(input.basePath, parentPath);
  const directoryPath = join(parentPath, normalizeDirectoryName(input.name));
  try {
    await mkdir(directoryPath);
    return { path: directoryPath };
  } catch (error) {
    throwDirectoryCreationError(error);
  }
}

export function isServerPathDirectoryCreateError(error: unknown): error is ServerPathDirectoryCreateError {
  return error instanceof ServerPathDirectoryCreateError;
}
