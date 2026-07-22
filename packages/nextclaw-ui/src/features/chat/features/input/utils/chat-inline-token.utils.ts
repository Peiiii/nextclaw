import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import {
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_INLINE_TOKENS_SCHEMA_VERSION,
  CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
  type ChatInlineTokenMetadata,
  type ChatInlineTokensMetadata,
  type ChatSkillSource,
} from '@nextclaw/shared';
import { serializeChatComposerTokenText } from './chat-composer-token-protocol.utils';

export { CHAT_INLINE_TOKENS_METADATA_KEY };
const CHAT_PANEL_APP_TOKEN_PREFIX = '@panel-app:';
const CHAT_PANEL_APP_TOKEN_PATTERN = /@panel-app:([A-Za-z0-9_-]+)/g;
const CHAT_WORKSPACE_FILE_TOKEN_PATTERN = /@file:([^\s]+)/g;
const CHAT_WORKSPACE_DIRECTORY_TOKEN_PATTERN = /@folder:([^\s]+)/g;

export type ChatSkillReferenceSnapshot = {
  ref: string;
  name: string;
  source: ChatSkillSource;
  path: string;
};

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
      kind: string;
      key: string;
      label: string;
      rawText: string;
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

export function buildInlineTokensFromComposer(
  nodes: readonly ChatComposerNode[],
  skillRecords: readonly ChatSkillReferenceSnapshot[] = [],
): ChatInlineTokenMetadata[] {
  const skillByRef = new Map(skillRecords.map((record) => [record.ref, record]));
  const tokens: ChatInlineTokenMetadata[] = [];
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
    if (node.tokenKind === 'skill') {
      const skill = skillByRef.get(node.tokenKey);
      if (!skill?.path.trim()) {
        continue;
      }
      tokens.push({
        kind: 'skill',
        ref: skill.ref,
        name: skill.name,
        source: skill.source,
        path: skill.path,
        label: node.label,
        rawText,
      });
      continue;
    }
    const workspaceKind = node.tokenKind === CHAT_WORKSPACE_FILE_TOKEN_KIND
      ? CHAT_WORKSPACE_FILE_TOKEN_KIND
      : CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND;
    tokens.push({
      kind: workspaceKind,
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
    if (!isRecord(entry)) {
      continue;
    }
    const kind = readOptionalString(entry.kind);
    const rawText = readOptionalString(entry.rawText);
    const label = readOptionalString(entry.label);
    if (!kind || !label || !rawText) {
      continue;
    }
    if (kind === 'skill') {
      const ref = readOptionalString(entry.ref);
      const name = readOptionalString(entry.name);
      const path = readOptionalString(entry.path);
      const source = readSkillSource(entry.source);
      if (!ref || !name || !path || !source) {
        continue;
      }
      tokens.push({ kind, ref, name, source, path, label, rawText });
      continue;
    }
    const key = readOptionalString(entry.key);
    if (!key) {
      continue;
    }
    tokens.push({
      kind,
      key,
      rawText,
      label,
    });
  }

  return dedupeInlineTokens(tokens);
}

function readSkillSource(value: unknown): ChatSkillSource | null {
  return value === 'builtin' || value === 'global' || value === 'project' || value === 'workspace'
    ? value
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
