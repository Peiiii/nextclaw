import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import {
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
  type ChatInlineTokenMetadata,
} from '@nextclaw/shared';
import { serializeChatComposerTokenText } from './chat-composer-token-protocol.utils';

export { CHAT_INLINE_TOKENS_METADATA_KEY };
const CHAT_PANEL_APP_TOKEN_PREFIX = '@panel-app:';
const CHAT_PANEL_APP_TOKEN_PATTERN = /@panel-app:([A-Za-z0-9_-]+)/g;
const CHAT_WORKSPACE_FILE_TOKEN_PATTERN = /@file:([^\s]+)/g;
const CHAT_WORKSPACE_DIRECTORY_TOKEN_PATTERN = /@folder:([^\s]+)/g;

export type ChatInlineTokenSource = ChatInlineTokenMetadata;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function dedupeInlineTokens(tokens: readonly ChatInlineTokenSource[]): ChatInlineTokenSource[] {
  const seen = new Set<string>();
  const output: ChatInlineTokenSource[] = [];
  for (const token of tokens) {
    const dedupeKey = `${token.kind}:${token.key}:${token.rawText}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    output.push(token);
  }
  return output;
}

export function buildInlineTokensFromComposer(nodes: readonly ChatComposerNode[]): ChatInlineTokenSource[] {
  const tokens: ChatInlineTokenSource[] = [];
  for (const node of nodes) {
    if (node.type !== 'token') {
      continue;
    }
    if (
      node.tokenKind !== 'skill' &&
      node.tokenKind !== CHAT_WORKSPACE_FILE_TOKEN_KIND &&
      node.tokenKind !== CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND
    ) {
      continue;
    }
    const rawText = serializeChatComposerTokenText(node);
    if (!rawText) {
      continue;
    }
    tokens.push({
      kind: node.tokenKind,
      key: node.tokenKey,
      label: node.label,
      rawText,
    });
  }
  return dedupeInlineTokens(tokens);
}

function appendWorkspaceTokens(params: {
  kind: typeof CHAT_WORKSPACE_FILE_TOKEN_KIND | typeof CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND;
  pattern: RegExp;
  text: string;
  tokens: ChatInlineTokenSource[];
}): void {
  const { kind, pattern, text, tokens } = params;
  for (const match of text.matchAll(pattern)) {
    const encodedKey = match[1];
    if (!encodedKey) {
      continue;
    }
    let key: string;
    try {
      key = decodeURIComponent(encodedKey);
    } catch {
      continue;
    }
    tokens.push({
      kind,
      key,
      label: key.split('/').filter(Boolean).at(-1) ?? key,
      rawText: match[0],
    });
  }
}

export function buildInlineTokensFromTextProtocol(text: string): ChatInlineTokenSource[] {
  const tokens: ChatInlineTokenSource[] = [];
  for (const match of text.matchAll(CHAT_PANEL_APP_TOKEN_PATTERN)) {
    const key = match[1];
    if (!key) {
      continue;
    }
    tokens.push({
      kind: 'panel_app',
      key,
      label: key,
      rawText: `${CHAT_PANEL_APP_TOKEN_PREFIX}${key}`
    });
  }
  appendWorkspaceTokens({
    kind: CHAT_WORKSPACE_FILE_TOKEN_KIND,
    pattern: CHAT_WORKSPACE_FILE_TOKEN_PATTERN,
    text,
    tokens,
  });
  appendWorkspaceTokens({
    kind: CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
    pattern: CHAT_WORKSPACE_DIRECTORY_TOKEN_PATTERN,
    text,
    tokens,
  });
  return dedupeInlineTokens(tokens);
}

export function resolveInlineTokensForText(
  text: string,
  tokens: readonly ChatInlineTokenSource[]
): ChatInlineTokenSource[] {
  return dedupeInlineTokens([...tokens, ...buildInlineTokensFromTextProtocol(text)]);
}

export function readInlineTokensFromMetadata(
  metadata: Record<string, unknown> | undefined
): ChatInlineTokenSource[] {
  const raw = metadata?.[CHAT_INLINE_TOKENS_METADATA_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }

  const tokens: ChatInlineTokenSource[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) {
      continue;
    }
    const kind = readOptionalString(entry.kind);
    const key = readOptionalString(entry.key);
    const rawText = readOptionalString(entry.rawText);
    if (!kind || !key || !rawText) {
      continue;
    }
    tokens.push({
      kind,
      key,
      rawText,
      label: readOptionalString(entry.label) ?? key
    });
  }

  return dedupeInlineTokens(tokens);
}
