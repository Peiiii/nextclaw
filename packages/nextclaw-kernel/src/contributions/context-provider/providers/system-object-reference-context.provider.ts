import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import {
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_INLINE_TOKENS_SCHEMA_VERSION,
  CHAT_SYSTEM_OBJECT_TOKEN_KIND,
  readSystemObjectResolvedReference,
  type SystemObjectResolvedReference,
} from "@nextclaw/shared";
import {
  isTextLikeAsset,
  type LocalAssetStore,
} from "@nextclaw/ncp-agent-runtime";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSystemObjectReferences(
  metadata: Record<string, unknown> | undefined,
): SystemObjectResolvedReference[] {
  const raw = metadata?.[CHAT_INLINE_TOKENS_METADATA_KEY];
  if (
    !isRecord(raw) ||
    raw.schemaVersion !== CHAT_INLINE_TOKENS_SCHEMA_VERSION ||
    !Array.isArray(raw.items)
  ) {
    return [];
  }
  const references: SystemObjectResolvedReference[] = [];
  const seen = new Set<string>();
  for (const item of raw.items) {
    if (!isRecord(item) || item.kind !== CHAT_SYSTEM_OBJECT_TOKEN_KIND) continue;
    const reference = readSystemObjectResolvedReference(item.reference);
    if (!reference || seen.has(`${reference.uri}@${reference.version}`)) continue;
    seen.add(`${reference.uri}@${reference.version}`);
    references.push(reference);
  }
  return references;
}

export class SystemObjectReferenceContextProvider implements ContextProvider {
  constructor(
    private readonly assetStore: Pick<
      LocalAssetStore,
      "readAssetBytes" | "statRecord"
    >,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly ContextBlock[]> => {
    const references = readSystemObjectReferences(
      request.message.metadata ?? request.metadata,
    );
    if (references.length === 0) return [];

    const sections = await Promise.all(references.map(async (reference) => {
      const asset = await this.assetStore.statRecord(reference.assetUri);
      if (
        !asset ||
        asset.sha256 !== reference.version ||
        asset.sizeBytes !== reference.sizeBytes ||
        asset.fileName !== reference.fileName ||
        asset.mimeType !== reference.mimeType ||
        !isTextLikeAsset({ mimeType: asset.mimeType, fileName: asset.fileName })
      ) {
        return [
          `### ${reference.label}`,
          `Object: ${reference.uri}`,
          `Version: ${reference.version}`,
          "Snapshot unavailable. Do not fall back to the live object.",
        ].join("\n");
      }
      const bytes = await this.assetStore.readAssetBytes(reference.assetUri);
      if (!bytes) {
        return [
          `### ${reference.label}`,
          `Object: ${reference.uri}`,
          `Version: ${reference.version}`,
          "Snapshot unavailable. Do not fall back to the live object.",
        ].join("\n");
      }
      return [
        `### ${reference.label}`,
        `Object: ${reference.uri}`,
        `Type: ${reference.objectType}`,
        `Version: ${reference.version}`,
        "",
        bytes.toString("utf8"),
      ].join("\n");
    }));
    return [[
      "## Explicit System Object References",
      "The user visibly referenced these immutable NextClaw-managed object snapshots in the current message.",
      "",
      sections.join("\n\n"),
    ].join("\n")];
  };
}
