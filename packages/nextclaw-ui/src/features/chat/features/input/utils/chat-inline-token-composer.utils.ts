import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import {
  CHAT_CONVERSATION_EXCERPT_TOKEN_KIND,
  CHAT_PROJECT_TOKEN_KIND,
  CHAT_SYSTEM_OBJECT_TOKEN_KIND,
  CHAT_UI_RESOURCE_TOKEN_KIND,
  CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
  CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
  type ChatInlineTokenMetadata,
  type ChatSkillSource,
  readChatUiResourceReference,
} from '@nextclaw/shared';

import { serializeChatComposerTokenText } from './chat-composer-token-protocol.utils';
import { buildConversationExcerptInlineToken } from './chat-conversation-excerpt-token.utils';
import { readSystemObjectResolvedReference } from './chat-system-object-reference.utils';

export type ChatSkillReferenceSnapshot = {
  ref: string;
  name: string;
  source: ChatSkillSource;
  path: string;
};

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readOptionalLine(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function dedupeInlineTokens(tokens: readonly ChatInlineTokenMetadata[]): ChatInlineTokenMetadata[] {
  const seen = new Set<string>();
  return tokens.filter((token) => {
    const identity = 'ref' in token ? token.ref : token.key;
    const dedupeKey = `${token.kind}:${identity}:${token.rawText}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
}

function buildWorkspaceExcerptToken(
  node: Extract<ChatComposerNode, { type: 'token' }>,
  rawText: string,
): ChatInlineTokenMetadata | null {
  const path = readOptionalString(node.data?.path);
  const excerpt = readOptionalString(node.data?.excerpt);
  if (!path || !excerpt) return null;
  return {
    kind: CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
    key: node.tokenKey,
    path,
    label: node.label,
    excerpt,
    startLine: readOptionalLine(node.data?.startLine),
    endLine: readOptionalLine(node.data?.endLine),
    rawText,
  };
}

function buildStructuredReferenceToken(
  node: Extract<ChatComposerNode, { type: 'token' }>,
  rawText: string,
): ChatInlineTokenMetadata | null | undefined {
  if (node.tokenKind === CHAT_WORKSPACE_EXCERPT_TOKEN_KIND) {
    return buildWorkspaceExcerptToken(node, rawText);
  }
  if (node.tokenKind === CHAT_CONVERSATION_EXCERPT_TOKEN_KIND) {
    return buildConversationExcerptInlineToken(node, rawText);
  }
  if (node.tokenKind === CHAT_SYSTEM_OBJECT_TOKEN_KIND) {
    const reference = readSystemObjectResolvedReference(node.data?.reference);
    return reference?.uri === node.tokenKey
      ? {
        kind: CHAT_SYSTEM_OBJECT_TOKEN_KIND,
        key: node.tokenKey,
        label: node.label,
        rawText,
        reference,
      }
      : null;
  }
  if (node.tokenKind === CHAT_UI_RESOURCE_TOKEN_KIND) {
    const reference = readChatUiResourceReference(node.data?.reference);
    return reference?.uri === node.tokenKey
      ? {
          kind: CHAT_UI_RESOURCE_TOKEN_KIND,
          key: node.tokenKey,
          label: node.label,
          rawText,
          reference,
        }
      : null;
  }
  return undefined;
}

export function buildInlineTokensFromComposer(
  nodes: readonly ChatComposerNode[],
  skillRecords: readonly ChatSkillReferenceSnapshot[] = [],
): ChatInlineTokenMetadata[] {
  const skillByRef = new Map(skillRecords.map((record) => [record.ref, record]));
  const tokens: ChatInlineTokenMetadata[] = [];
  for (const node of nodes) {
    if (node.type !== 'token') continue;
    const rawText = serializeChatComposerTokenText(node);
    if (!rawText) continue;
    if (node.tokenKind === 'skill') {
      const skill = skillByRef.get(node.tokenKey);
      if (skill?.path.trim()) {
        tokens.push({
          kind: 'skill',
          ref: skill.ref,
          name: skill.name,
          source: skill.source,
          path: skill.path,
          label: node.label,
          rawText,
        });
      }
      continue;
    }
    if (node.tokenKind === CHAT_PROJECT_TOKEN_KIND) {
      tokens.push({ kind: CHAT_PROJECT_TOKEN_KIND, key: node.tokenKey, label: node.label, rawText });
      continue;
    }
    const structuredReference = buildStructuredReferenceToken(node, rawText);
    if (structuredReference !== undefined) {
      if (structuredReference) tokens.push(structuredReference);
      continue;
    }
    if (
      node.tokenKind === CHAT_WORKSPACE_FILE_TOKEN_KIND ||
      node.tokenKind === CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND
    ) {
      const workspaceKind = node.tokenKind === CHAT_WORKSPACE_FILE_TOKEN_KIND
        ? CHAT_WORKSPACE_FILE_TOKEN_KIND
        : CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND;
      tokens.push({ kind: workspaceKind, key: node.tokenKey, label: node.label, rawText });
    }
  }
  return dedupeInlineTokens(tokens);
}
