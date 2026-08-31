import {
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_INLINE_TOKENS_SCHEMA_VERSION,
  CHAT_PROJECT_TOKEN_KIND,
  CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
  CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
} from "@nextclaw/shared";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import type { ProjectManager } from "@kernel/features/projects/index.js";
import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import {
  type RegisteredProjectReference,
  WorkspaceReferenceMaterializerService,
  type WorkspaceContextReference,
  type WorkspaceExcerptReference,
  type WorkspaceReference,
} from "@kernel/contributions/context-provider/services/workspace-reference-materializer.service.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type ProjectReference = Omit<RegisteredProjectReference, "project">;
type RawWorkspaceContextReference =
  | ProjectReference
  | WorkspaceReference
  | WorkspaceExcerptReference;

function readLine(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function readWorkspaceReferences(
  metadata: Record<string, unknown> | undefined,
): RawWorkspaceContextReference[] {
  const raw = metadata?.[CHAT_INLINE_TOKENS_METADATA_KEY];
  const rawTokens = Array.isArray(raw)
    ? raw
    : isRecord(raw) &&
        raw.schemaVersion === CHAT_INLINE_TOKENS_SCHEMA_VERSION &&
        Array.isArray(raw.items)
      ? raw.items
      : null;
  if (!rawTokens) {
    return [];
  }
  const references: RawWorkspaceContextReference[] = [];
  const seen = new Set<string>();
  for (const rawToken of rawTokens) {
    if (!isRecord(rawToken)) {
      continue;
    }
    const kind = rawToken.kind === CHAT_WORKSPACE_FILE_TOKEN_KIND
      ? CHAT_WORKSPACE_FILE_TOKEN_KIND
      : rawToken.kind === CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND
        ? CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND
        : rawToken.kind === CHAT_WORKSPACE_EXCERPT_TOKEN_KIND
          ? CHAT_WORKSPACE_EXCERPT_TOKEN_KIND
        : rawToken.kind === CHAT_PROJECT_TOKEN_KIND
          ? CHAT_PROJECT_TOKEN_KIND
          : null;
    const key = readString(rawToken.key);
    if (!kind || !key || seen.has(`${kind}:${key}`)) {
      continue;
    }
    seen.add(`${kind}:${key}`);
    if (kind === CHAT_WORKSPACE_EXCERPT_TOKEN_KIND) {
      const path = readString(rawToken.path);
      const excerpt = readString(rawToken.excerpt);
      if (!path || !excerpt) {
        continue;
      }
      references.push({
        kind,
        key,
        path,
        excerpt,
        label: readString(rawToken.label) ?? path,
        startLine: readLine(rawToken.startLine),
        endLine: readLine(rawToken.endLine),
      });
      continue;
    }
    references.push({
      kind,
      key,
      label: readString(rawToken.label) ?? key,
    });
  }
  return references;
}

export class WorkspaceReferenceContextProvider implements ContextProvider {
  private readonly materializer = new WorkspaceReferenceMaterializerService();

  constructor(
    private readonly context: ContextProviderRunContextService,
    private readonly projects: ProjectManager,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly ContextBlock[]> => {
    const references = readWorkspaceReferences(request.message.metadata ?? request.metadata);
    if (references.length === 0) {
      return [];
    }
    const [{ projectContext }, registeredProjects] = await Promise.all([
      this.context.resolve(request),
      references.some((reference) => reference.kind === CHAT_PROJECT_TOKEN_KIND)
        ? this.projects.listProjects()
        : Promise.resolve([]),
    ]);
    const projectByRootPath = new Map(
      registeredProjects.map((project) => [project.rootPath, project]),
    );
    const resolvedReferences: WorkspaceContextReference[] = references.map(
      (reference) => reference.kind === CHAT_PROJECT_TOKEN_KIND
        ? {
            ...reference,
            project: projectByRootPath.get(reference.key) ?? null,
          }
        : reference,
    );
    return [
      await this.materializer.materialize({
        projectRoot: projectContext.effectiveWorkspace,
        references: resolvedReferences,
      }),
    ];
  };
}
