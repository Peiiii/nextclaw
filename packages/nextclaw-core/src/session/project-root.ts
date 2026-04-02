import { resolveSessionProjectContext } from "./session-project-context.js";

export { readSessionProjectRoot } from "./session-project-context.js";

export function resolveSessionWorkspacePath(params: {
  sessionMetadata?: Record<string, unknown> | null;
  workspace?: string;
  defaultWorkspace?: string;
}): string {
  return resolveSessionProjectContext(params).effectiveWorkspace;
}
