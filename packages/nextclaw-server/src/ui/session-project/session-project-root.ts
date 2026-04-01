import { realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { expandHome } from "@nextclaw/core";

export class SessionProjectRootValidationError extends Error {
  constructor(
    readonly code:
      | "PROJECT_ROOT_INVALID_TYPE"
      | "PROJECT_ROOT_NOT_FOUND"
      | "PROJECT_ROOT_NOT_DIRECTORY",
    message: string,
  ) {
    super(message);
    this.name = "SessionProjectRootValidationError";
  }
}

function resolveCandidateProjectRoot(value: string): string {
  return resolve(expandHome(value));
}

export async function normalizeSessionProjectRoot(
  value: unknown,
): Promise<string | null> {
  if (value == null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new SessionProjectRootValidationError(
      "PROJECT_ROOT_INVALID_TYPE",
      "projectRoot must be a string or null",
    );
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = resolveCandidateProjectRoot(trimmed);
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(candidate);
  } catch {
    throw new SessionProjectRootValidationError(
      "PROJECT_ROOT_NOT_FOUND",
      "projectRoot directory does not exist",
    );
  }

  const projectRootStats = await stat(canonicalPath);
  if (!projectRootStats.isDirectory()) {
    throw new SessionProjectRootValidationError(
      "PROJECT_ROOT_NOT_DIRECTORY",
      "projectRoot must point to a directory",
    );
  }

  return canonicalPath;
}

export function isSessionProjectRootValidationError(
  error: unknown,
): error is SessionProjectRootValidationError {
  return error instanceof SessionProjectRootValidationError;
}
