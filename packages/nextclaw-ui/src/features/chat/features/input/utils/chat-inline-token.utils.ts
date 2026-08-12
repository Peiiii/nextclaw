import {
  CHAT_CONVERSATION_EXCERPT_TOKEN_KIND,
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_INLINE_TOKENS_SCHEMA_VERSION,
  CHAT_PROJECT_TOKEN_KIND,
  CHAT_SYSTEM_OBJECT_TOKEN_KIND,
  CHAT_UI_RESOURCE_TOKEN_KIND,
  CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
  CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
  type ChatInlineTokenMetadata,
  type ChatInlineTokensMetadata,
  type ChatSkillSource,
  type SystemObjectResolvedReference,
  type ChatUiResourceReference,
  readChatUiResourceReference,
} from '@nextclaw/shared';
import { readConversationExcerptInlineToken } from './chat-conversation-excerpt-token.utils';
import { readSystemObjectResolvedReference } from './chat-system-object-reference.utils';
export {
  buildInlineTokensFromComposer,
  type ChatSkillReferenceSnapshot,
} from './chat-inline-token-composer.utils';

export { CHAT_INLINE_TOKENS_METADATA_KEY };
const CHAT_PANEL_APP_TOKEN_PREFIX = '@panel-app:';
const CHAT_PANEL_APP_TOKEN_PATTERN = /@panel-app:([A-Za-z0-9_-]+)/g;
const CHAT_PROJECT_TOKEN_PATTERN = /@project:([^\s]+)/g;
const CHAT_WORKSPACE_FILE_TOKEN_PATTERN = /@file:([^\s]+)/g;
const CHAT_WORKSPACE_DIRECTORY_TOKEN_PATTERN = /@folder:([^\s]+)/g;
const CHAT_SYSTEM_OBJECT_TOKEN_PATTERN = /@object:([^\s]+)/g;
const CHAT_UI_RESOURCE_TOKEN_PATTERN = /@resource:([^\s]+)/g;

export type ChatInlineTokenSource =
  | {
      kind: 'skill';
      ref: string;
      name: string;
      source: ChatSkillSource | null;
      path: string | null;
      label: string;
      rawText: string;
    }
  | {
      kind: typeof CHAT_CONVERSATION_EXCERPT_TOKEN_KIND;
      key: string;
      messageId: string;
      role: 'assistant' | 'user';
      label: string;
      excerpt: string;
      rawText: string;
    }
  | {
      kind: typeof CHAT_WORKSPACE_EXCERPT_TOKEN_KIND;
      key: string;
      path: string;
      label: string;
      excerpt: string;
      startLine: number | null;
      endLine: number | null;
      rawText: string;
    }
  | {
      kind: string;
      key: string;
      label: string;
      rawText: string;
    }
  | {
      kind: typeof CHAT_SYSTEM_OBJECT_TOKEN_KIND;
      key: string;
      label: string;
      rawText: string;
      reference: SystemObjectResolvedReference;
    }
  | {
      kind: typeof CHAT_UI_RESOURCE_TOKEN_KIND;
      key: string;
      label: string;
      rawText: string;
      reference: ChatUiResourceReference;
    };

export function resolveWorkspaceReferencePath(params: {
  projectRoot: string | null | undefined;
  relativePath: string;
}): string | null {
  const projectRoot = params.projectRoot?.trim().replace(/[\\/]+$/, '') ?? '';
  const relativeSegments = params.relativePath.trim().replace(/\\/g, '/').split('/');
  if (
    !projectRoot ||
    relativeSegments.length === 0 ||
    relativeSegments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null;
  }
  const separator = projectRoot.includes('\\') ? '\\' : '/';
  return `${projectRoot}${separator}${relativeSegments.join(separator)}`;
}

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

function readOptionalLine(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function dedupeInlineTokens<T extends ChatInlineTokenSource>(tokens: readonly T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const token of tokens) {
    const identity = 'ref' in token ? token.ref : token.key;
    const dedupeKey = `${token.kind}:${identity}:${token.rawText}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    output.push(token);
  }
  return output;
}

function appendEncodedKeyTokens(params: {
  kind:
    | typeof CHAT_PROJECT_TOKEN_KIND
    | typeof CHAT_SYSTEM_OBJECT_TOKEN_KIND
    | typeof CHAT_UI_RESOURCE_TOKEN_KIND
    | typeof CHAT_WORKSPACE_FILE_TOKEN_KIND
    | typeof CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND;
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
      label: key.split(/[\\/]+/).filter(Boolean).at(-1) ?? key,
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
  appendEncodedKeyTokens({
    kind: CHAT_PROJECT_TOKEN_KIND,
    pattern: CHAT_PROJECT_TOKEN_PATTERN,
    text,
    tokens,
  });
  appendEncodedKeyTokens({
    kind: CHAT_SYSTEM_OBJECT_TOKEN_KIND,
    pattern: CHAT_SYSTEM_OBJECT_TOKEN_PATTERN,
    text,
    tokens,
  });
  appendEncodedKeyTokens({
    kind: CHAT_UI_RESOURCE_TOKEN_KIND,
    pattern: CHAT_UI_RESOURCE_TOKEN_PATTERN,
    text,
    tokens,
  });
  appendEncodedKeyTokens({
    kind: CHAT_WORKSPACE_FILE_TOKEN_KIND,
    pattern: CHAT_WORKSPACE_FILE_TOKEN_PATTERN,
    text,
    tokens,
  });
  appendEncodedKeyTokens({
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
  const inferredTokens = buildInlineTokensFromTextProtocol(text).filter((inferredToken) => {
    const inferredIndex = text.indexOf(inferredToken.rawText);
    return !tokens.some((explicitToken) => (
      explicitToken.kind === inferredToken.kind &&
      inferredToken.rawText.startsWith(explicitToken.rawText) &&
      text.indexOf(explicitToken.rawText) === inferredIndex
    ));
  });
  return dedupeInlineTokens([...tokens, ...inferredTokens]);
}

export function readInlineTokensFromMetadata(
  metadata: Record<string, unknown> | undefined
): ChatInlineTokenSource[] {
  const raw = metadata?.[CHAT_INLINE_TOKENS_METADATA_KEY];
  if (Array.isArray(raw)) {
    return readLegacyInlineTokens(raw);
  }
  if (
    !isRecord(raw) ||
    raw.schemaVersion !== CHAT_INLINE_TOKENS_SCHEMA_VERSION ||
    !Array.isArray(raw.items)
  ) {
    return [];
  }

  const tokens: ChatInlineTokenSource[] = [];
  for (const entry of raw.items) {
    const token = readInlineTokenEntry(entry);
    if (token) tokens.push(token);
  }

  return dedupeInlineTokens(tokens);
}

function readSkillSource(value: unknown): ChatSkillSource | null {
  return value === 'builtin' || value === 'global' || value === 'project' || value === 'workspace'
    ? value
    : null;
}

function readInlineTokenEntry(entry: unknown): ChatInlineTokenSource | null {
  if (!isRecord(entry)) {
    return null;
  }
  const kind = readOptionalString(entry.kind);
  const rawText = readOptionalString(entry.rawText);
  const label = readOptionalString(entry.label);
  if (!kind || !label || !rawText) {
    return null;
  }
  if (kind === 'skill') {
    const ref = readOptionalString(entry.ref);
    const name = readOptionalString(entry.name);
    const path = readOptionalString(entry.path);
    const source = readSkillSource(entry.source);
    return ref && name && path && source
      ? { kind, ref, name, source, path, label, rawText }
      : null;
  }
  if (kind === CHAT_WORKSPACE_EXCERPT_TOKEN_KIND) {
    return readWorkspaceExcerptInlineToken({ entry, label, rawText });
  }
  if (kind === CHAT_CONVERSATION_EXCERPT_TOKEN_KIND) {
    return readConversationExcerptInlineToken({ entry, label, rawText });
  }
  if (kind === CHAT_SYSTEM_OBJECT_TOKEN_KIND) {
    const key = readOptionalString(entry.key);
    const reference = readSystemObjectResolvedReference(entry.reference);
    return key && reference && reference.uri === key
      ? { kind, key, label, rawText, reference }
      : null;
  }
  if (kind === CHAT_UI_RESOURCE_TOKEN_KIND) {
    const key = readOptionalString(entry.key);
    const reference = readChatUiResourceReference(entry.reference);
    return key && reference && reference.uri === key
      ? { kind, key, label, rawText, reference }
      : null;
  }
  const key = readOptionalString(entry.key);
  return key ? { kind, key, rawText, label } : null;
}

function readWorkspaceExcerptInlineToken(params: {
  entry: Record<string, unknown>;
  label: string;
  rawText: string;
}): ChatInlineTokenSource | null {
  const { entry, label, rawText } = params;
  const key = readOptionalString(entry.key);
  const path = readOptionalString(entry.path);
  const excerpt = readOptionalString(entry.excerpt);
  return key && path && excerpt
    ? {
        kind: CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
        key,
        path,
        label,
        excerpt,
        startLine: readOptionalLine(entry.startLine),
        endLine: readOptionalLine(entry.endLine),
        rawText,
      }
    : null;
}

function readLegacyInlineTokens(entries: readonly unknown[]): ChatInlineTokenSource[] {
  const tokens: ChatInlineTokenSource[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }
    const kind = readOptionalString(entry.kind);
    const key = readOptionalString(entry.key);
    const rawText = readOptionalString(entry.rawText);
    if (!kind || !key || !rawText) {
      continue;
    }
    const label = readOptionalString(entry.label) ?? key;
    tokens.push(kind === 'skill'
      ? { kind, ref: key, name: label, source: null, path: null, label, rawText }
      : { kind, key, label, rawText });
  }
  return dedupeInlineTokens(tokens);
}

export function createInlineTokensMetadata(
  items: ChatInlineTokenMetadata[],
): ChatInlineTokensMetadata {
  return {
    schemaVersion: CHAT_INLINE_TOKENS_SCHEMA_VERSION,
    items,
  };
}
