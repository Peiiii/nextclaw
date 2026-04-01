import { resolve } from "node:path";
import { expandHome, getWorkspacePath } from "../utils/helpers.js";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readSessionProjectRoot(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) {
    return null;
  }
  return (
    normalizeOptionalString(metadata.project_root) ??
    normalizeOptionalString(metadata.projectRoot)
  );
}

export function resolveSessionWorkspacePath(params: {
  sessionMetadata?: Record<string, unknown> | null;
  workspace?: string;
  defaultWorkspace?: string;
}): string {
  const projectRoot = readSessionProjectRoot(params.sessionMetadata);
  if (projectRoot) {
    return resolve(expandHome(projectRoot));
  }
  return getWorkspacePath(params.workspace ?? params.defaultWorkspace);
}
