import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';

export const CHAT_UI_INLINE_TOKENS_METADATA_KEY = 'ui_inline_tokens';
const CHAT_SKILL_TOKEN_PREFIX = '$';
const CHAT_PANEL_APP_TOKEN_PREFIX = '@panel-app:';
const CHAT_PANEL_APP_TOKEN_PATTERN = /@panel-app:([A-Za-z0-9_-]+)/g;

export type ChatInlineTokenSource = { kind: string; key: string; label: string; rawText: string };

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

export function buildInlineSkillTokensFromComposer(nodes: readonly ChatComposerNode[]): ChatInlineTokenSource[] {
  const tokens: ChatInlineTokenSource[] = [];
  for (const node of nodes) {
    if (node.type !== 'token' || node.tokenKind !== 'skill') {
      continue;
    }
    tokens.push({
      kind: 'skill',
      key: node.tokenKey,
      label: node.label,
      rawText: `${CHAT_SKILL_TOKEN_PREFIX}${node.tokenKey}`
    });
  }
  return dedupeInlineTokens(tokens);
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
  const raw = metadata?.[CHAT_UI_INLINE_TOKENS_METADATA_KEY];
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
