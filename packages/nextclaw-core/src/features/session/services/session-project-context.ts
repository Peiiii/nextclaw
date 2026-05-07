import { join, resolve } from "node:path";
import { expandHome, getWorkspacePath } from "../utils/helpers.js";

export const DEFAULT_PROJECT_SKILLS_DIR_NAME = ".agents/skills";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type SessionProjectContext = {
  hostWorkspace: string;
  effectiveWorkspace: string;
  projectRoot: string | null;
  projectBootstrapRoot: string | null;
  projectSkillsRoot: string | null;
};

export class SessionProjectContextResolver {
  constructor(
    private readonly projectSkillsDirName = DEFAULT_PROJECT_SKILLS_DIR_NAME,
  ) {}

  readProjectRoot = (
    metadata: Record<string, unknown> | null | undefined,
  ): string | null => {
    if (!metadata) {
      return null;
    }
    return (
      normalizeOptionalString(metadata.project_root) ??
      normalizeOptionalString(metadata.projectRoot)
    );
  };

  resolve = (params: {
    sessionMetadata?: Record<string, unknown> | null;
    workspace?: string;
    defaultWorkspace?: string;
  }): SessionProjectContext => {
    const hostWorkspace = getWorkspacePath(params.workspace ?? params.defaultWorkspace);
    const rawProjectRoot = this.readProjectRoot(params.sessionMetadata);
    const projectRoot = rawProjectRoot ? resolve(expandHome(rawProjectRoot)) : null;

    return {
      hostWorkspace,
      effectiveWorkspace: projectRoot ?? hostWorkspace,
      projectRoot,
      projectBootstrapRoot: projectRoot,
      projectSkillsRoot: projectRoot
        ? join(projectRoot, this.projectSkillsDirName)
        : null,
    };
  };
}

const defaultResolver = new SessionProjectContextResolver();

export function readSessionProjectRoot(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  return defaultResolver.readProjectRoot(metadata);
}

export function resolveSessionProjectContext(params: {
  sessionMetadata?: Record<string, unknown> | null;
  workspace?: string;
  defaultWorkspace?: string;
  projectSkillsDirName?: string;
}): SessionProjectContext {
  if (params.projectSkillsDirName) {
    return new SessionProjectContextResolver(params.projectSkillsDirName).resolve(params);
  }
  return defaultResolver.resolve(params);
}
