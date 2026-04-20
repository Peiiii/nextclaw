import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';

export const CHAT_UI_INLINE_TOKENS_METADATA_KEY = 'ui_inline_tokens';
const CHAT_SKILL_TOKEN_PREFIX = '$';

export type ChatInlineTokenSource = { kind: string; key: string; label: string; rawText: string };

export type ChatInlineTextFragment =
  | { type: 'text'; text: string }
  | { type: 'token'; token: ChatInlineTokenSource };

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

export function splitTextByInlineTokens(
  text: string,
  tokens: readonly ChatInlineTokenSource[]
): ChatInlineTextFragment[] {
  if (text.length === 0 || tokens.length === 0) {
    return text.length === 0 ? [] : [{ type: 'text', text }];
  }

  const orderedTokens = [...tokens].sort((left, right) => right.rawText.length - left.rawText.length);
  const fragments: ChatInlineTextFragment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let matchedToken: ChatInlineTokenSource | null = null;
    for (const token of orderedTokens) {
      if (text.startsWith(token.rawText, cursor)) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      let nextCursor = cursor + 1;
      while (nextCursor < text.length) {
        if (orderedTokens.some((token) => text.startsWith(token.rawText, nextCursor))) {
          break;
        }
        nextCursor += 1;
      }
      fragments.push({
        type: 'text',
        text: text.slice(cursor, nextCursor)
      });
      cursor = nextCursor;
      continue;
    }

    fragments.push({
      type: 'token',
      token: matchedToken
    });
    cursor += matchedToken.rawText.length;
  }

  return fragments;
}
