import {
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_INLINE_TOKENS_SCHEMA_VERSION,
  CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
} from "@nextclaw/shared";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import {
  WorkspaceReferenceMaterializerService,
  type WorkspaceReference,
} from "@kernel/contributions/context-provider/services/workspace-reference-materializer.service.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readWorkspaceReferences(metadata: Record<string, unknown> | undefined): WorkspaceReference[] {
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
  const references: WorkspaceReference[] = [];
  const seen = new Set<string>();
  for (const rawToken of rawTokens) {
    if (!isRecord(rawToken)) {
      continue;
    }
    const kind = rawToken.kind === CHAT_WORKSPACE_FILE_TOKEN_KIND
      ? CHAT_WORKSPACE_FILE_TOKEN_KIND
      : rawToken.kind === CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND
        ? CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND
        : null;
    const key = readString(rawToken.key);
    if (!kind || !key || seen.has(`${kind}:${key}`)) {
      continue;
    }
    seen.add(`${kind}:${key}`);
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

  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (request: AgentRunRequest): Promise<readonly ContextBlock[]> => {
    const references = readWorkspaceReferences(request.message.metadata ?? request.metadata);
    if (references.length === 0) {
      return [];
    }
    const { projectContext } = await this.context.resolve(request);
    return [
      await this.materializer.materialize({
        projectRoot: projectContext.effectiveWorkspace,
        references,
      }),
    ];
  };
}
