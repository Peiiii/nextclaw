import {
  CHAT_SESSION_MATERIALIZATION_METADATA_KEY,
  type AgentRunSessionMaterializationMetadata,
} from "@nextclaw/shared";
import {
  buildInlineTokensFromComposer,
  CHAT_INLINE_TOKENS_METADATA_KEY,
  createInlineTokensMetadata,
  type ChatSkillReferenceSnapshot,
} from "@/features/chat/features/input/utils/chat-inline-token.utils";
import { normalizeRequestedSkills } from "@/features/chat/features/runtime/utils/chat-runtime.utils";
import { normalizeSessionProjectRootValue } from "@/shared/lib/session-project";

function createMetadataFields(
  value: string | undefined,
  fields: readonly string[],
): Record<string, string> {
  return value ? Object.fromEntries(fields.map((field) => [field, value])) : {};
}

export function buildChatRunMetadata(payload: {
  agentId?: string;
  model?: string;
  thinkingLevel?: string;
  sessionType?: string;
  projectRoot?: string | null;
  requestedSkills?: string[];
  skillRecords?: readonly ChatSkillReferenceSnapshot[];
  composerNodes?: Parameters<typeof buildInlineTokensFromComposer>[0];
  sessionMaterialization?: AgentRunSessionMaterializationMetadata | null;
}): Record<string, unknown> {
  const projectRoot = normalizeSessionProjectRootValue(payload.projectRoot);
  const metadata: Record<string, unknown> = {
    ...createMetadataFields(payload.model?.trim(), ["model", "preferred_model"]),
    ...createMetadataFields(payload.thinkingLevel?.trim(), ["thinkingEffort", "thinking", "preferred_thinking"]),
    ...createMetadataFields(payload.sessionType?.trim(), ["agentRuntimeId", "session_type", "runtime"]),
    ...createMetadataFields(payload.agentId?.trim(), ["agentId", "agent_id"]),
    ...createMetadataFields(projectRoot ?? undefined, ["projectRoot", "project_root"]),
  };
  const requestedSkills = normalizeRequestedSkills(payload.requestedSkills);
  if (requestedSkills.length > 0) {
    metadata.requested_skill_refs = requestedSkills;
  }
  const inlineTokens = payload.composerNodes
    ? buildInlineTokensFromComposer(payload.composerNodes, payload.skillRecords)
    : [];
  if (inlineTokens.length > 0) {
    metadata[CHAT_INLINE_TOKENS_METADATA_KEY] = createInlineTokensMetadata(inlineTokens);
  }
  if (payload.sessionMaterialization) {
    metadata[CHAT_SESSION_MATERIALIZATION_METADATA_KEY] = payload.sessionMaterialization;
  }
  return metadata;
}

export function shouldClearPendingProjectRootOverride(params: {
  pendingProjectRoot: string | null;
  pendingProjectRootSessionKey: string | null;
  sessionKey: string | null | undefined;
  selectedSessionProjectRoot: string | null | undefined;
}): boolean {
  const {
    pendingProjectRoot,
    pendingProjectRootSessionKey,
    selectedSessionProjectRoot,
    sessionKey,
  } = params;
  return (
    pendingProjectRoot !== null &&
    pendingProjectRootSessionKey !== null &&
    sessionKey === pendingProjectRootSessionKey &&
    (selectedSessionProjectRoot ?? null) === pendingProjectRoot
  );
}
