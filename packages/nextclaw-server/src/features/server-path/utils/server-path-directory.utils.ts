import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  resolveServerPath,
  ServerPathResolutionError,
} from "@nextclaw-server/features/server-path/utils/server-path-resolution.utils.js";

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
    throw new ServerPathDirectoryCreateError(
      "SERVER_PATH_DIRECTORY_NAME_INVALID",
      "directory name is invalid",
    );
  }
  return name;
}

function readFileErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : undefined;
}

export async function createServerPathDirectory(input: {
  parentPath: unknown;
  name: unknown;
}): Promise<{ path: string }> {
  let parentPath: string;
  try {
    parentPath = resolveServerPath({
      path: typeof input.parentPath === "string" ? input.parentPath : null,
    });
  } catch (error) {
    if (error instanceof ServerPathResolutionError) {
      throw new ServerPathDirectoryCreateError(
        "SERVER_PATH_PARENT_INVALID",
        error.message,
      );
    }
    throw error;
  }
  const directoryPath = join(parentPath, normalizeDirectoryName(input.name));
  try {
    await mkdir(directoryPath);
    return { path: directoryPath };
  } catch (error) {
    const code = readFileErrorCode(error);
    if (code === "EEXIST") {
      throw new ServerPathDirectoryCreateError(
        "SERVER_PATH_DIRECTORY_EXISTS",
        "directory already exists",
      );
    }
    if (code === "ENOENT") {
      throw new ServerPathDirectoryCreateError(
        "SERVER_PATH_PARENT_NOT_FOUND",
        "parent directory does not exist",
      );
    }
    if (code === "ENOTDIR") {
      throw new ServerPathDirectoryCreateError(
        "SERVER_PATH_PARENT_NOT_DIRECTORY",
        "parent path must point to a directory",
      );
    }
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new ServerPathDirectoryCreateError(
        "SERVER_PATH_PARENT_NOT_WRITABLE",
        "parent directory is not writable",
      );
    }
    throw error;
  }
}

export function isServerPathDirectoryCreateError(
  error: unknown,
): error is ServerPathDirectoryCreateError {
  return error instanceof ServerPathDirectoryCreateError;
}
